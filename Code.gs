/**
 * 부울경 성경세미나 신앙상담 신청 데이터 수신 스크립트
 * 
 * [배포 방법]
 * 1. 스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 이 코드를 붙여넣기
 * 3. 오른쪽 상단 [배포] > [새 배포] 클릭
 * 4. 유형 선택: [웹 앱]
 *    - 설명: 신앙상담 신청 API
 *    - 다음 사용자 권한으로 앱 실행: [나 (본인 이메일)]
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)]  <-- 중요! 로그인 없이 제출 가능
 * 5. [배포] 클릭 후 생성된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 복사
 * 6. index.html의 SCRIPT_URL 부분에 붙여넣기
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};

    if (e && e.postData && e.postData.type && e.postData.type.indexOf("application/json") !== -1) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    var inviter = data.inviter || '';
    var inviterPhone = data.inviter_phone || '';
    var invitee = data.invitee || '';
    var inviteePhone = data.invitee_phone || '';
    var day = data.day || '';
    var time = data.time || '';
    var note = data.note || '';

    // 요일 및 시간 가독성 변환
    var dayTextMap = {
      'wed': '10.14(수)',
      'thu': '10.15(목)',
      'fri': '10.16(금)'
    };
    var timeTextMap = {
      'am': '오전 2부 (10:30 말씀 이후)',
      'pm': '오후 2부 (6:00 말씀 이후)'
    };

    var formattedDay = dayTextMap[day] || day;
    var formattedTime = timeTextMap[time] || time;

    sheet.appendRow([
      timestamp,
      inviter,
      inviterPhone,
      invitee,
      inviteePhone,
      formattedDay,
      formattedTime,
      note
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      message: '신청이 정상적으로 접수되었습니다.'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// 웹 앱 동작 여부 테스트용 GET 핸들러
function doGet(e) {
  return ContentService.createTextOutput("신앙상담 접수 서버가 정상 동작 중입니다.");
}
