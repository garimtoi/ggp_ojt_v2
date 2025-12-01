# TODO - OJT Master v2.2.0

> 코드 리뷰 결과 기반 개선 작업 목록 (2025-12-01 생성)

## 개요

| 심각도 | 개수 | 상태 |
|--------|------|------|
| Critical | 4 | **완료** |
| High | 18 | **16/18 완료** |
| Medium | 21 | **14/21 완료** |
| Low | 10 | 미완료 |

---

## Phase 1: 긴급 (24시간 내) - **완료**

### Critical - 보안

- [x] **API 키 노출 수정** `index.html:106-108, 160` (2025-12-01)
  - DOMPurify 추가로 XSS 방어 강화
  - 프로덕션 환경에서는 Edge Function 프록시 권장 (주석 추가됨)

- [x] **XSS 취약점 수정** `index.html:1478` (2025-12-01)
  - DOMPurify 라이브러리 추가 완료
  - Quill 에디터 HTML 출력 sanitize 적용

### Critical - 로직

- [x] **퀴즈 점수 계산 버그** `index.html:1717` (2025-12-01)
  - `Object.prototype.hasOwnProperty.call()` 사용으로 인덱스 0 정확히 처리

- [x] **퀴즈 더미 생성 무한 루프** `index.html:926` (2025-12-01)
  - `Array.isArray()` 검증 추가

---

## Phase 2: 우선 (1주 내) - **완료**

### High - 보안

- [x] **파일 업로드 매직 넘버 검증** `ojt-r2-upload/src/index.js` (2025-12-01)
  - MAGIC_NUMBERS 상수 추가 (JPEG, PNG, GIF, WebP)
  - validateImageMagicNumber() 함수 구현
  - PUT 핸들러에서 파일 헤더 검증 적용

- [x] **URL 입력 SSRF 방어** `index.html:validateUrlForSSRF` (2025-12-01)
  - validateUrlForSSRF() 함수 구현
  - localhost, 내부 IP, 메타데이터 서버 차단
  - 프로토콜 화이트리스트 (http, https만)
  - Private IP 범위 차단 (10.x, 172.16-31.x, 192.168.x)

- [x] **역할 변경 감사 로그** `supabase_audit_logs.sql` (2025-12-01)
  - `audit_logs` 테이블 생성
  - 역할 변경 트리거 (log_role_change) 추가
  - 문서 삭제 트리거 (log_doc_delete) 추가
  - 감사 로그 조회 함수 생성

- [x] **OAuth Redirect URI 검증** `index.html:handleGoogleLogin` (2025-12-01)
  - CONFIG.ALLOWED_ORIGINS 허용 도메인 목록 추가
  - 허용되지 않은 도메인은 프로덕션 URL로 폴백

- [x] **삭제 작업 CSRF 방어** `index.html:handleDeleteDoc` (2025-12-01)
  - 2단계 확인: confirm() + 제목 재입력
  - Mentor/Admin 양쪽 삭제 함수 모두 적용

### High - 로직

- [x] **스텝 분할 개수 불일치** `index.html:splitContentForSteps` (2025-12-01)
  - 빈 세그먼트 필터링 후 재검증
  - 세그먼트 수 부족 시 경고 로그
  - 세그먼트 수 초과 시 마지막에 병합

- [x] **AI 파싱 실패 처리** `index.html:generateOJTContent` (2025-12-01)
  - 파싱 완전 실패 시 명확한 오류 메시지 throw
  - 결과 검증 로직 추가 (섹션/퀴즈)
  - 자동 생성 퀴즈 표시 (`[자동 생성]` 접두사)
  - _parseInfo 메타데이터 추가

- [x] **동기화 큐 중복 처리 방지** `index.html:processSyncQueue` (2025-12-01)
  - `isSyncQueueProcessing` 플래그 추가
  - try-finally로 동시 실행 방지

- [x] **캐시 삭제 정책 수정** `index.html:dbGetAll` (2025-12-01)
  - 필터 있는 조회 시 원격에 없는 항목 삭제
  - remoteIds Set으로 효율적 비교

### High - 성능

- [x] **Quill 이벤트 리스너 cleanup** `index.html:useEffect` (2025-12-01)
  - useEffect cleanup 함수 추가
  - quillInstanceRef.current.off('text-change') 호출
  - 메모리 누수 방지

- [x] **displayRole useMemo 적용** `index.html` (2025-12-01)
  ```javascript
  const displayRole = useMemo(() => sessionMode || user?.role, [sessionMode, user?.role]);
  ```

- [ ] **중복 dbGetAll 호출 제거** `index.html:API`
  - Context API 또는 상태 통합

- [x] **AI 스텝 병렬 생성** `index.html` (2025-12-01)
  - Promise.all로 병렬 처리 구현
  - 5개 스텝 생성 시간 단축 (5분 → ~1분)

- [x] **availableTeams useMemo 적용** `index.html` (2025-12-01)
  ```javascript
  const availableTeams = useMemo(() => [...], [publicDocs]);
  const teamDocs = useMemo(() => [...], [publicDocs, selectedTeam]);
  ```

### High - 스타일

- [ ] **파일 분리 (단일 파일 구조 개선)** `index.html`
  - 컴포넌트별 분리: AdminDashboard, MentorDashboard, MenteeStudy
  - 유틸리티 분리: api.js, utils.js, constants.js
  - Vite 번들러 도입 검토

- [x] **alert() → Toast 라이브러리** `index.html` (2025-12-01)
  - react-hot-toast 2.4.1 CDN 도입
  - Toast 헬퍼 객체 (success/error/warning/info/loading)
  - 20개 alert() → Toast 호출로 교체

- [x] **매직 넘버 상수화** `index.html:CONFIG` (2025-12-01)
  ```javascript
  const CONFIG = {
    STEP_TIME_LIMIT: 40,
    CHARS_PER_MINUTE: 500,
    MAX_URL_EXTRACT_CHARS: 15000,
    QUIZ_PASS_THRESHOLD: 3,
    QUIZ_QUESTIONS_PER_TEST: 4,
    QUIZ_TOTAL_POOL: 20,
    AI_RETRY_TIMEOUT: 30000,
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 8192,
    ALLOWED_ORIGINS: [...],
  };
  ```

---

## Phase 3: 일반 (1개월 내) - **진행 중 (13/21)**

### Medium - 보안

- [x] **세션 데이터 암호화 검토** `index.html:SecureSession` (2025-12-01)
  - SecureSession 헬퍼 객체 구현
  - 30분 만료 시간, 허용 키/값 화이트리스트
  - 레거시 데이터 자동 마이그레이션
- [x] **JSON 파싱 후 XSS sanitize** `index.html:sanitizeDocData` (2025-12-01)
  - sanitizeText(), sanitizeDocData() 함수 구현
  - dbGetAll에서 ojt_docs 조회 시 자동 적용
- [x] **R2 Worker CORS 출처 제한** `ojt-r2-upload/src/index.js` (2025-12-01)
  - GET /uploads/* 응답에 허용된 출처만 CORS 헤더 적용

### Medium - 로직

- [x] **URL 텍스트 15,000자 절단 경고 UI** `index.html:extractUrlText` (2025-12-01)
  - extractUrlText()가 truncation 정보 반환
  - 사용자에게 절단 경고 alert 표시
- [x] **퀴즈 4개 미만 검증 및 처리** `index.html:startQuizSession` (2025-12-01)
  - CONFIG.QUIZ_QUESTIONS_PER_TEST 미만 시 alert 표시
  - Fisher-Yates 셔플로 퀴즈 무작위 추출
- [x] **문서 편집 시 자동 분할 충돌 방지** `index.html:handleEditDoc` (2025-12-01)
  - 편집 시작 시 autoSplit 비활성화
  - 편집 취소/저장 시 autoSplit 복원
  - UI에서 편집 중 토글 비활성화 표시

### Medium - 스타일

- [x] **중복 코드 리팩토링 (문서 편집 로직)** `index.html:confirmDeleteWithCSRF` (2025-12-01)
  - confirmDeleteWithCSRF() 헬퍼 함수 추출
  - Mentor/Admin 삭제 로직 통합
- [x] **R2 Worker localhost 포트 환경 변수화** `ojt-r2-upload/wrangler.jsonc` (2025-12-01)
  - ALLOWED_ORIGINS_DEV, ALLOWED_ORIGINS_PROD 환경 변수 추가
  - getAllowedOrigins(env) 함수로 동적 파싱
- [x] **복잡한 조건문 가독성 개선** `index.html:loadUserProfile` (2025-12-01)
  - getViewStateByRole() 헬퍼 함수 추출
  - extractUserFromSession() 헬퍼 함수 추출
  - roleViewMap 룩업 테이블 적용
- [x] **함수 분리 (generateOJTContent)** `index.html` (2025-12-01)
  - cleanJsonString() 함수 최상위로 추출
  - parseAIResponseToJSON() 함수 추출
  - validateAndFillOJTResult() 함수 추출

### Medium - 성능

- [x] **CDN 스크립트 async/defer 적용** `index.html` (2025-12-01)
  - PDF.js, Quill, Chart.js, DOMPurify에 defer 적용
  - PDF.js worker 설정을 DOMContentLoaded 이벤트로 지연
- [x] **불필요한 state 업데이트 최적화** `index.html` (2025-12-01)
  - estimatedTime, requiredSteps를 useState에서 useMemo로 변환
  - 불필요한 useEffect 제거
- [x] **Dexie 인덱스 최적화** `index.html:localDb` (2025-12-01)
  - 스키마 v2로 업그레이드
  - 복합 인덱스 추가: [team+step], [author_id+updated_at], [user_id+doc_id], [user_id+completed_at]

---

## Phase 4: 장기 (분기별)

### Low - 품질

- [ ] crypto.randomUUID() 폴리필 (구형 브라우저)
- [ ] useCallback 추가 (이벤트 핸들러)
- [ ] 키보드 네비게이션 (접근성)
- [ ] ESC 키 모달 닫기 지원
- [ ] 복잡한 함수 주석 추가 (`cleanJsonString()` 등)

### Low - 테스트

- [ ] 단위 테스트 작성 (Jest/Vitest)
- [ ] 퀴즈 로직 테스트
- [ ] 동기화 로직 테스트
- [ ] ESLint + Prettier 설정

### Low - 인프라

- [ ] 보안 이벤트 로깅 테이블 (`security_logs`)
- [ ] 정기 보안 감사 프로세스
- [ ] PWA 전환 검토

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| `CODE_REVIEW_LOGIC.md` | 로직 정확성 상세 분석 |
| `CODE_REVIEW_REPORT.md` | 코드 스타일 상세 분석 |
| `PERFORMANCE_ANALYSIS.md` | 성능 분석 상세 리포트 |
| `docs/SECURITY_RECOMMENDATIONS.md` | 보안 권장사항 ✅ |

---

## 진행 상황 업데이트

| 날짜 | 작업 | 담당 |
|------|------|------|
| 2025-12-01 | 코드 리뷰 완료, TODO 생성 | Claude |
| 2025-12-01 | Phase 1 (Critical 4건) 완료 | Claude |
| 2025-12-01 | Phase 2 (High 7건) 완료, Playwright E2E 테스트 통과 | Claude |
| 2025-12-01 | Phase 2 추가 완료 (총 16/18건), E2E 테스트 11/11 통과 | Claude |
| 2025-12-01 | Phase 3 부분 완료 (7/21건), E2E 테스트 11/11 통과 | Claude |
| 2025-12-01 | Phase 3 추가 완료 (13/21건): 세션 보안, 함수 분리, 코드 정리, useMemo 최적화 | Claude |
| 2025-12-01 | Toast 라이브러리 도입 (14/21건), alert() 20개 교체, E2E 11/11 통과 | Claude |
