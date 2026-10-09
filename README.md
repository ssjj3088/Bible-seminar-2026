# 부울경 성경세미나 신앙상담 신청 시스템 & Cloudflare Pages 배포 가이드

## 2026-10-09 소속 교회 항목 추가

두 신청 경로에 **소속 교회 (선택)** 입력란을 추가했습니다. 초청자 소속 교회를 입력하며, 최대 100자입니다. 입력하지 않아도 신청할 수 있습니다. 기존 A:H는 유지하고 I열에 저장하며, 관리자 카드에서 표시·검색할 수 있습니다. 기존 8열 신청은 교회명이 `미입력`으로 표시됩니다.

새 Apps Script는 최초 신청 저장 또는 초기 설정 시 빈 I열에 `소속 교회` 헤더를 추가합니다. I열을 다른 용도로 사용하는 경우 먼저 별도 열로 옮겨야 합니다. 프론트엔드와 Apps Script를 함께 새 버전으로 배포해야 소속 교회가 저장됩니다.

## 2026-10-07 QA 수정 적용 및 배포 순서

신청 화면 두 경로와 관리자 화면, Apps Script를 함께 업데이트해야 합니다.
관리자 인증은 서버에서 검증하는 4자리 숫자 PIN 또는 32~256자의 접근 키를 사용합니다. PIN은 HTML에 저장하지 않고 서버에는 SHA-256 해시만 저장합니다. 여러 관리자가 같은 PIN을 공유할 수 있지만, 단순한 PIN은 추측에 취약하며 현재 로그인 시도 횟수 제한은 없습니다.
신청 명단의 A:H 8열 순서는 유지하며, I열에 초청자 소속 교회를 추가했습니다.

1. 먼저 별도 테스트 시트와 테스트 웹 앱에서 아래 절차를 확인합니다.
2. 접수용 Google Sheets에서 사용할 탭을 선택합니다. 기존 명단은 첫 행에 헤더가 있어야 하며, A:H 순서는 `접수일시 / 초청자 이름 / 초청자 연락처 / 초청받으신 분 성함 / 초청받으신 분 연락처 / 희망 상담 요일 / 희망 상담 시간 / 기타 전달사항`입니다.
3. 시트에 연결된 Apps Script의 `Code.gs`를 이 저장소의 코드로 교체합니다.
4. 함께 사용할 4자리 숫자 관리자 PIN을 정하고 안전하게 보관합니다. 보안을 높이려면 비밀번호 관리자로 32~256자의 무작위 접근 키를 생성할 수 있습니다. 실제 PIN·키를 HTML, Git, 로그에 넣지 않습니다.
5. Apps Script 편집기에서 `configureCounseling`을 직접 실행하고 PIN 또는 접근 키를 입력합니다. 선택한 시트 ID·탭 이름과 키의 SHA-256 해시가 Script Properties에 저장됩니다. 빈 탭이면 A:I 헤더를 생성합니다. 기존 탭에는 I열 헤더만 추가하며 A:H 데이터는 수정하지 않습니다. I열을 다른 용도로 사용 중이면 덮어쓰지 않고 오류로 중단합니다. 이 함수는 시트에 연결된 스크립트에서만 실행합니다.
6. 기존 웹 앱 배포를 **새 버전**으로 업데이트합니다. 공개 GET 명단 조회는 차단되고, 접근 키가 있는 POST 조회만 허용됩니다. 기존 공개 조회를 제공하는 다른 배포가 있으면 함께 폐쇄합니다.
7. 새 배포 URL이 생겼다면 `index.html`, `counseling-apply.html`, `admin.html`의 `SCRIPT_URL`을 같은 URL로 변경합니다. 기존 배포를 수정해 URL이 유지되면 변경할 필요가 없습니다.
8. 세 HTML 파일을 함께 Cloudflare Pages에 배포합니다. 프론트엔드만 GitHub에 반영해도 Apps Script 코드는 자동 업데이트되지 않습니다.
9. 관리자 화면에서 설정한 PIN 또는 접근 키로 로그인합니다. 보이는 화면에서 30초마다 명단을 확인하며 실패 시 조회 간격이 늘어납니다. 로그아웃하면 접근 키와 화면의 명단을 제거합니다.

Apps Script가 시트에 연결돼 있지 않다면 `SPREADSHEET_ID`, `SHEET_NAME`, `ADMIN_TOKEN_SHA256`를 Script Properties에 직접 설정합니다. 마지막 값은 접근 키를 UTF-8로 SHA-256 처리한 소문자 64자리 hex입니다. 접근 키 변경은 설정을 다시 실행하거나 해시를 교체합니다.

### 로컬 검증

```bash
node tests/regression.cjs
```

실제 Sheets 서비스 대신 모의 서비스를 이용하므로 운영 데이터를 변경하지 않습니다.
브라우저 검증은 Playwright가 설치된 환경에서 다음 명령으로 실행합니다.

```bash
node tests/browser.cjs
```

별도 위치의 Playwright를 쓸 때는 `QA_PLAYWRIGHT_MODULE`에 해당 모듈 경로를 지정합니다. 브라우저 테스트는 외부 네트워크 요청을 차단하고 가짜 데이터만 사용합니다.

배포 후에는 신청 성공·실패 배너, A:I 저장, 소속 교회 표시·검색, 관리자 인증, 초청자 전용 통화·문자, iOS/Android 메시지 본문 및 실제 클립보드 붙여넣기를 확인합니다. 특히 Sheets의 텍스트 서식·수식 방어와 실제 배포의 CORS/권한은 로컬 모의 검증만으로 보장되지 않습니다.

현재 재시도에 대한 영속적인 중복 접수 방지와 봇/요청 빈도 제한은 구현하지 않았습니다. 응답 유실 시에는 접수 여부를 먼저 확인하도록 안내하며 자동으로 신청을 재전송하지 않습니다. 공유 접근 키 대신 관리자별 로그인이 필요하면 서버 인증 구성을 추가해야 합니다.

---

## 1. `*.pages.dev` 도메인과 웹사이트의 정체

문의하신 `https://busan-global-culture-show-2026.pages.dev/song-contest-apply` 형태의 주소는 **GitHub + Cloudflare Pages(클라우드플레어 페이지)** 조합으로 운영되는 완전 무료 웹사이트입니다.

- **`.pages.dev` 도메인**: 글로벌 네트워크 기업인 Cloudflare에서 제공하는 기본 무료 도메인입니다. (평생 무료, SSL 인증서/HTTPS 자동 적용, 무제한 대역폭)
- **`/song-contest-apply` 또는 `/counseling-apply` 경로**: 프로젝트 안에 `counseling-apply.html` 파일이 있으면 자동으로 `https://도메인/counseling-apply` 형태로 열립니다.
- **자동 배포**: GitHub 저장소에 코드를 push하면 Cloudflare Pages가 감지하여 수초 내에 사이트를 자동 업데이트합니다.

---

## 2. 내 컴퓨터에서 준비 완료된 내용

현재 작업 폴더([부산 성경세미나](file:///Users/songjaeyong/Desktop/부산%20성경세미나/))에 다음 작업이 이미 완료되어 있습니다:

1. **Git 버전 관리 저장소 초기화 및 첫 커밋 완료** (`git init`, 첫 커밋 완료)
2. **페이지 파일 구성**:
   - `index.html`: 메인 페이지 접속 시 열림 (`https://내프로젝트.pages.dev/`)
   - `counseling-apply.html`: 신청 경로 접속 시 열림 (`https://내프로젝트.pages.dev/counseling-apply`)
3. **무료 데이터 수집 연동**:
   - 구글 스프레드시트: [부울경 성경세미나 신앙상담 신청 명단](https://docs.google.com/spreadsheets/d/1q2YEB1f6wc6vstcXyPXY0oPzKuTP0RWYkw_rwBOp-1o/edit)
   - 연동 스크립트: `Code.gs`

---

## 3. GitHub & Cloudflare Pages 무료 배포 4단계

### 1단계: GitHub에 저장소(Repository) 생성
1. [GitHub](https://github.com)에 로그인합니다.
2. 우측 상단 `+` 버튼 > **New repository** 클릭합니다.
3. 저장소 이름(Repository name)을 입력합니다. (예: `busan-seminar-2026`)
4. **Public** 선택 후 [Create repository]를 누릅니다.

### 2단계: 로컬 코드를 GitHub에 올리기 (Push)
터미널을 열고 다음 3줄을 순서대로 실행합니다:
```bash
cd "/Users/songjaeyong/Desktop/부산 성경세미나"
git remote add origin https://github.com/<본인아이디>/<저장소이름>.git
git push -u origin main
```

### 3단계: Cloudflare Pages에서 무료 사이트 생성
1. [Cloudflare](https://dash.cloudflare.com/sign-up) 무료 회원가입 후 로그인합니다.
2. 좌측 메뉴에서 **Workers & Pages** > **Create application** (애플리케이션 생성) 클릭
3. 상단 탭에서 **Pages** 선택 > **Connect to Git** (Git에 연결) 클릭
4. GitHub 계정을 연동하고, 1단계에서 만든 저장소를 선택합니다.
5. 설정 화면:
   - **프로젝트 이름**: 원하는 도메인명 입력 (예: `busan-seminar-2026` 입력 시 `https://busan-seminar-2026.pages.dev` 가 됩니다)
   - **프레임워크 사전 설정**: `None`
   - **빌드 출력 디렉터리**: `/` (비워두거나 기본값 유지)
6. 하단 **[Save and Deploy] (저장 및 배포)** 클릭!

### 4단계: 배포 완료 및 접속 확인
- 약 30초 내에 배포가 완료되며, 생성된 URL이 표시됩니다:
  - `https://<지정한이름>.pages.dev/`
  - `https://<지정한이름>.pages.dev/counseling-apply`
