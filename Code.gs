/** 부울경 성경세미나 상담 접수 API.
 * SPREADSHEET_ID: 대상 스프레드시트 ID
 * SHEET_NAME: A:H 헤더가 존재하는 접수 시트 이름 (I열: 초청자 소속 교회)
 * ADMIN_TOKEN_SHA256: 32자 이상 무작위 접근 키의 SHA-256 소문자 hex
 * 실제 접근 키는 관리자에게 별도 전달하고 HTML/Git에 저장하지 않는다.
 */
// 시트에 연결된 Apps Script 편집기에서 직접 실행하는 초기 설정 함수.
function configureCounseling() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  var response = ui.prompt('관리자 접근 키 설정',
    '접수 탭: ' + sheet.getName() + '\n비밀번호 관리자에서 생성한 32~256자의 무작위 키를 입력하세요. 기존 1234는 사용할 수 없습니다.',
    ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var token = response.getResponseText().trim();
  if (token.length < 32 || token.length > 256) {
    ui.alert('접근 키는 32~256자로 입력해주세요.');
    return;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 8).setValues([[
      '접수일시', '초청자 이름', '초청자 연락처', '초청받으신 분 성함',
      '초청받으신 분 연락처', '희망 상담 요일', '희망 상담 시간', '기타 전달사항'
    ]]);
  }
  ensureChurchColumn_(sheet);
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    SHEET_NAME: sheet.getName(),
    ADMIN_TOKEN_SHA256: hash_(token)
  }, false);
  ui.alert('설정 완료: ' + sheet.getName() + '\n기존 웹 앱 배포를 새 버전으로 업데이트해주세요.');
}

function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function fail_(code, message) { return json_({result: 'error', code: code, message: message}); }
function config_() { return PropertiesService.getScriptProperties().getProperties(); }
function sheet_(config) {
  if (!config.SPREADSHEET_ID || !config.SHEET_NAME) throw new Error('CONFIG_ERROR');
  var sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(config.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 1) throw new Error('CONFIG_ERROR');
  return sheet;
}
function hasChurchColumn_(sheet) {
  if (sheet.getMaxColumns() < 9) return false;
  return ['소속 교회', '소속교회', '초청자 소속 교회'].indexOf(
    String(sheet.getRange(1, 9).getValue()).trim()) !== -1;
}
function ensureChurchColumn_(sheet) {
  var columns = sheet.getMaxColumns();
  if (columns < 9) sheet.insertColumnsAfter(columns, 9 - columns);
  if (hasChurchColumn_(sheet)) return;
  var header = sheet.getRange(1, 9);
  // 다른 용도로 사용 중인 I열을 덮어쓰지 않는다.
  if (header.getValue() !== '' || (sheet.getLastRow() > 1 &&
      sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).getValues().some(function(row) {
        return row[0] !== '' && row[0] != null;
      }))) throw new Error('CONFIG_ERROR');
  header.setValue('소속 교회');
}
function parse_(e) {
  if (e && e.postData && String(e.postData.type).indexOf('application/json') !== -1) {
    var value = JSON.parse(e.postData.contents);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_INPUT');
    return value;
  }
  return e && e.parameter || {};
}
function text_(value, required, limit) {
  if (value == null) value = '';
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  value = value.trim();
  if ((required && !value) || value.length > limit) throw new Error('INVALID_INPUT');
  return value;
}
function normalizePhone_(value) {
  if (value == null || value === '') return '';
  var raw = String(value).trim();
  if (!/^\+?[0-9()\s-]+$/.test(raw)) return '';
  var n = raw.replace(/[()\s-]/g, '');
  if (n.indexOf('+82') === 0) n = '0' + n.slice(3);
  if (/^10\d{8}$/.test(n)) n = '0' + n;
  return /^010\d{8}$|^01[16789]\d{7,8}$|^02\d{7,8}$|^0(?:31|32|33|41|42|43|44|51|52|53|54|55|61|62|63|64)\d{7,8}$|^070\d{8}$/.test(n) ? n : '';
}
function phone_(value) {
  var raw = text_(value, false, 40);
  var normalized = normalizePhone_(raw);
  if (raw && !normalized) throw new Error('INVALID_PHONE');
  return normalized;
}
function cell_(value) {
  // 텍스트 서식만으로 수식 해석 방지를 보장하지 않는다.
  return /^[=+@-]/.test(value) ? "'" + value : value;
}
function authorized_(token, config) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256 ||
      !/^[a-f0-9]{64}$/.test(config.ADMIN_TOKEN_SHA256 || '')) return false;
  var hash = hash_(token);
  var diff = 0;
  for (var i = 0; i < 64; i++) diff |= hash.charCodeAt(i) ^ config.ADMIN_TOKEN_SHA256.charCodeAt(i);
  return diff === 0;
}
function list_(data, config) {
  if (!authorized_(data.admin_token, config)) return fail_('UNAUTHORIZED', '인증이 필요합니다.');
  var sheet = sheet_(config);
  var count = sheet.getLastRow() - 1;
  var columns = hasChurchColumn_(sheet) ? 9 : 8;
  var rows = count > 0 ? sheet.getRange(2, 1, count, columns).getValues() : [];
  var fields = ['timestamp', 'inviter', 'inviterPhone', 'invitee', 'inviteePhone', 'day', 'time', 'note', 'church'];
  var items = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (!row[0] && !row[1] && !row[3]) continue;
    var item = {};
    for (var j = 0; j < fields.length; j++) {
      item[fields[j]] = j === 0 && row[j] instanceof Date
        ? Utilities.formatDate(row[j], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
        : String(row[j] == null ? '' : row[j]);
    }
    items.push(item);
  }
  return json_({result: 'success', data: items});
}
function doGet(e) {
  // 기존의 공개 명단 조회 경로를 반드시 폐쇄한다.
  return fail_('UNAUTHORIZED', '인증이 필요합니다.');
}
function doPost(e) {
  var lock = null;
  var acquired = false;
  try {
    var data = parse_(e);
    var config = config_();
    if (data.action === 'list') return list_(data, config);
    if (data.action && data.action !== 'apply') throw new Error('INVALID_INPUT');
    var dayMap = {wed: '10.14(수)', thu: '10.15(목)', fri: '10.16(금)'};
    var timeMap = {am: '오전 2부 (10:30 말씀 이후)', pm: '오후 2부 (6:00 말씀 이후)'};
    var inviter = text_(data.inviter, true, 80);
    var invitee = text_(data.invitee, true, 80);
    var inviterPhone = phone_(data.inviter_phone);
    var inviteePhone = phone_(data.invitee_phone);
    var note = text_(data.note, false, 2000);
    var church = text_(data.church, false, 100);
    if (typeof data.day !== 'string' || !Object.prototype.hasOwnProperty.call(dayMap, data.day) ||
        typeof data.time !== 'string' || !Object.prototype.hasOwnProperty.call(timeMap, data.time)) {
      throw new Error('INVALID_INPUT');
    }
    lock = LockService.getScriptLock();
    acquired = lock.tryLock(10000);
    if (!acquired) return fail_('BUSY', '접수가 집중되고 있습니다. 잠시 후 다시 시도해주세요.');
    var sheet = sheet_(config);
    ensureChurchColumn_(sheet);
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var row = [timestamp, inviter, inviterPhone, invitee, inviteePhone,
      dayMap[data.day], timeMap[data.time], note, church].map(cell_);
    var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, 9);
    range.setNumberFormat('@');
    range.setValues([row]);
    SpreadsheetApp.flush();
    return json_({result: 'success', message: '신청이 정상적으로 접수되었습니다.'});
  } catch (error) {
    var code = ['INVALID_INPUT', 'INVALID_PHONE'].indexOf(error.message) !== -1
      ? error.message : 'SERVER_ERROR';
    console.error('counseling_api:' + code); // 이름·전화번호·접근 키는 기록하지 않음.
    return fail_(code, code === 'SERVER_ERROR'
      ? '처리 중 문제가 발생했습니다. 담당자에게 문의해주세요.'
      : '입력 내용을 확인해주세요.');
  } finally {
    if (acquired) lock.releaseLock();
  }
}
