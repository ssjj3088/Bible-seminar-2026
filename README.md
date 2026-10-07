# 부울경 성경세미나 신앙상담 신청 시스템 & Cloudflare Pages 배포 가이드

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
