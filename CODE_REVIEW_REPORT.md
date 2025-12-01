# 코드 스타일 검토 보고서

**프로젝트**: OJT Master v2.2.0
**검토 일자**: 2025-12-01
**검토 범위**: `index.html` (2,710줄), `ojt-r2-upload/src/index.js` (205줄)

---

## 개요

이 보고서는 단일 파일 SPA 구조의 React 애플리케이션과 Cloudflare R2 Worker의 코드 품질을 분석합니다.

### 주요 메트릭

| 항목 | 수치 |
|------|------|
| 총 코드 라인 수 | 2,710 (index.html) + 205 (R2 Worker) |
| 함수 정의 | 100+ 개 |
| React Hooks 사용 | 62회 |
| async 함수 | 31개 |
| 배열 메서드 (.map, .filter 등) | 36회 |
| 디버깅 코드 (console, alert) | 69회 |

---

## Critical Issues (즉시 수정 필요)

### 1. 보안: API 키 클라이언트 노출

**심각도**: High
**파일**: `index.html:160`

```javascript
const GEMINI_API_KEY = "AIzaSyCvH1uc1OJ7EHmiWfsjbKVFH-X8KuvXH2I";
```

**문제점**:
- Google Gemini API 키가 클라이언트 코드에 하드코딩되어 있음
- HTTP Referer 제한이 있어도 우회 가능
- 브라우저 DevTools로 즉시 확인 가능

**개선 권장**:
```javascript
// Supabase Edge Function으로 프록시
const response = await fetch('/api/generate-content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, team, step })
});
```

---

### 2. 보안: Supabase 키 노출

**심각도**: High
**파일**: `index.html:107`

```javascript
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cPiRemnriBwn8rCT1JL9Qg_mjCeCBaI";
```

**문제점**:
- Publishable Key는 공개되어도 무방하나, 키 형식이 비정상적 (일반적으로 `eyJ...` 형태)
- 실제 프로덕션 키로 보이며, 코드에 직접 노출

**개선 권장**:
- 환경 변수로 관리
- Vercel 환경 변수 설정 활용
- `.env.local` (로컬), Vercel Dashboard (프로덕션)

---

### 3. 단일 파일 구조의 유지보수성 문제

**심각도**: High
**파일**: `index.html` (2,710줄)

**문제점**:
- 모든 코드가 하나의 HTML 파일에 집중
- 컴포넌트 분리 불가 (MentorDashboard, AdminDashboard 등 1,000줄 이상)
- 검색 및 디버깅 어려움

**개선 권장**:
```
src/
├── components/
│   ├── Header.jsx
│   ├── LoginPage.jsx
│   ├── AdminDashboard.jsx
│   ├── MentorDashboard.jsx
│   └── MenteeStudy.jsx
├── utils/
│   ├── supabase.js
│   ├── dexie.js
│   └── gemini.js
└── App.jsx
```

---

### 4. 에러 처리: 사용자 경험 부족

**심각도**: Medium
**파일**: `index.html` (여러 위치)

**문제점**:
```javascript
// 예시 1: index.html:1388
alert("Google 로그인 중 오류가 발생했습니다: " + e.message);

// 예시 2: index.html:1408
alert("역할 저장 중 오류가 발생했습니다.");

// 예시 3: index.html:1553
alert(`오류: ${error.message}`);
```

- `alert()` 사용으로 인한 나쁜 UX (모달 차단)
- 기술적 오류 메시지 노출 (사용자 혼란)

**개선 권장**:
```javascript
// Toast 라이브러리 사용 (react-hot-toast 등)
import toast from 'react-hot-toast';

try {
  await supabase.auth.signInWithOAuth({ provider: 'google' });
} catch (e) {
  console.error("Login error:", e);
  toast.error('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
}
```

---

## Warnings (수정 권장)

### 5. 명명 규칙: 일관성 부족

**심각도**: Medium
**파일**: `index.html` (여러 위치)

**문제점**:

| 코드 위치 | 문제 | 개선 |
|----------|------|------|
| `line 71` | `const { useState, useEffect, ... } = React;` | React 임포트 명시적으로 |
| `line 610` | `const TEAMS = [...]` | 상수는 별도 파일로 분리 |
| `line 944` | `function App()` | 컴포넌트는 PascalCase (이미 준수) |
| `line 269` | `function estimateReadingTime(text)` | camelCase 준수 (Good) |

**혼용 사례**:
```javascript
// 함수 선언 vs 화살표 함수
function estimateReadingTime(text) { ... }  // 일반 함수
const isOnline = () => navigator.onLine;    // 화살표 함수
async function uploadImageToR2(file) { ... } // async 함수
```

**개선 권장**:
- 순수 유틸리티 함수: `function` 선언
- 콜백/이벤트 핸들러: 화살표 함수
- React 컴포넌트: `const Component = () => { ... }` 또는 `function Component() { ... }`

---

### 6. 매직 넘버: 하드코딩된 상수

**심각도**: Medium
**파일**: `index.html` (여러 위치)

**문제점**:
```javascript
// line 264-266
const STEP_TIME_LIMIT = 40; // 분
const CHARS_PER_MINUTE = 500; // 한국어 기준
const MAX_CHARS_PER_STEP = STEP_TIME_LIMIT * CHARS_PER_MINUTE; // 20,000자

// line 692
if (text.length > 15000) {
  text = text.substring(0, 15000) + '...\n\n[내용이 너무 길어 일부만 추출되었습니다]';
}

// line 807-808
temperature: 0.3,
maxOutputTokens: 8192
```

**개선 권장**:
```javascript
// constants.js
export const CONTENT_EXTRACTION = {
  URL_MAX_LENGTH: 15000,
  TRUNCATE_MESSAGE: '\n\n[내용이 너무 길어 일부만 추출되었습니다]'
};

export const AI_CONFIG = {
  TEMPERATURE: 0.3,
  MAX_TOKENS: 8192,
  STEP_TIME_LIMIT_MINUTES: 40,
  READING_SPEED_CHARS_PER_MIN: 500
};

export const QUIZ = {
  PASS_THRESHOLD: 3,
  TOTAL_QUESTIONS: 20,
  RANDOM_SELECT_COUNT: 4
};
```

---

### 7. 중복 코드: DRY 원칙 위반

**심각도**: Medium
**파일**: `index.html:1630-1672` vs `index.html:2173-2189`

**문제점**:
```javascript
// 편집 로직 중복 (2회 반복)
const handleEditDoc = (doc) => {
  setEditingDoc(doc);
  setInputTitle(doc.title || '');
  setInputTeam(doc.team || TEAMS[0]);
  setInputStep(doc.step || 1);
  // ... 중복 코드 30줄
};

// Admin 대시보드에서도 동일한 로직 반복
onClick={() => {
  sessionStorage.setItem('ojt_sessionMode', 'mentor');
  setSessionMode('mentor');
  const mappedDoc = { ... }; // 동일한 매핑 로직
  handleEditDoc(mappedDoc);
  setViewState('mentor_dashboard');
}}
```

**개선 권장**:
```javascript
// utils/docMapper.js
export const mapSupabaseDocToApp = (doc) => ({
  ...doc,
  authorId: doc.author_id,
  author: doc.author_name,
  estimatedMinutes: doc.estimated_minutes,
  createdAt: new Date(doc.created_at).getTime()
});

// 사용
const mappedDoc = mapSupabaseDocToApp(doc);
handleEditDoc(mappedDoc);
```

---

### 8. 함수 크기: 단일 책임 원칙 위반

**심각도**: Medium
**파일**: `index.html:724-939` (215줄)

**문제점**:
```javascript
async function generateOJTContent(rawText, team, step, setProgress, totalSteps = 1) {
  // 1. 프롬프트 생성 (60줄)
  const prompt = `/no_think\n당신은 10년 경력...`;

  // 2. Gemini API 호출 (20줄)
  const response = await fetch(...);

  // 3. JSON 파싱 (60줄)
  let cleanedResponse = responseText.replace(...);

  // 4. 정규식 fallback (40줄)
  const titleMatch = cleanedResponse.match(...);

  // 5. 퀴즈 더미 생성 (10줄)
  while (result.quiz && result.quiz.length < 20) { ... }
}
```

**개선 권장**:
```javascript
// utils/aiGenerator.js
export class OJTGenerator {
  static buildPrompt(rawText, team, step, totalSteps) { ... }
  static async callGeminiAPI(prompt) { ... }
  static parseResponse(responseText) { ... }
  static fallbackParse(text) { ... }
  static fillQuizDummies(quiz, title) { ... }

  static async generate(rawText, team, step, setProgress, totalSteps) {
    const prompt = this.buildPrompt(rawText, team, step, totalSteps);
    const response = await this.callGeminiAPI(prompt);
    return this.parseResponse(response);
  }
}
```

---

### 9. R2 Worker: CORS 설정 검증 부족

**심각도**: Medium
**파일**: `ojt-r2-upload/src/index.js:4-8`

**문제점**:
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:51544',  // 임시 포트 하드코딩
  'https://ggp-ojt-v2.vercel.app'
];
```

- 로컬 개발 포트가 변경되면 CORS 에러 발생
- Vercel Preview 배포 도메인 미포함

**개선 권장**:
```javascript
const ALLOWED_ORIGINS = [
  // 로컬 개발
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  // Vercel 배포
  'https://ggp-ojt-v2.vercel.app',
  /^https:\/\/ggp-ojt-v2-.*\.vercel\.app$/  // Preview 배포 포함
];

const isAllowedOrigin = (origin) => {
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') return allowed === origin;
    if (allowed instanceof RegExp) return allowed.test(origin);
    return false;
  });
};
```

---

## Suggestions (개선 고려)

### 10. React 패턴: useCallback 누락

**심각도**: Low
**파일**: `index.html:1447-1558`

**문제점**:
```javascript
const handleGenerate = async () => {
  // ... 100줄의 로직
};

const handleSaveToDB = async () => {
  // ... 50줄의 로직
};

// useEffect 의존성 배열에서 경고 발생 가능
useEffect(() => {
  if (condition) handleGenerate();
}, [rawInput]); // 경고: handleGenerate가 의존성에 없음
```

**개선 권장**:
```javascript
const handleGenerate = useCallback(async () => {
  // ... 로직
}, [rawInput, aiStatus, inputTeam, inputStep]);

const handleSaveToDB = useCallback(async () => {
  // ... 로직
}, [user, generatedDoc, generatedDocs, editingDoc]);
```

---

### 11. 가독성: 복잡한 조건문

**심각도**: Low
**파일**: `index.html:1201-1258`

**문제점**:
```javascript
const loadUserProfile = async (session) => {
  if (!session?.user) {
    console.log("No session user, redirecting to login");
    setUser(null);
    setViewState('login');
    setIsLoadingAuth(false);
    return;
  }

  try {
    const profile = await dbGet("users", session.user.id);
    if (profile && profile.role) {
      setUser(profile);
      const tempMode = sessionStorage.getItem('ojt_sessionMode');
      if (profile.role === 'admin' && tempMode === 'mentor') {
        setSessionMode('mentor');
        setViewState('mentor_dashboard');
      } else if (profile.role === 'admin') {
        setViewState('admin_dashboard');
      } else if (profile.role === 'mentor') {
        setViewState('mentor_dashboard');
      } else if (profile.role === 'mentee') {
        setViewState('mentee_list');
      } else {
        setViewState('role_select');
      }
    } else { ... }
  } catch (e) { ... }
};
```

**개선 권장**:
```javascript
const loadUserProfile = async (session) => {
  if (!session?.user) {
    return handleNoSession();
  }

  try {
    const profile = await dbGet("users", session.user.id);

    if (!profile?.role) {
      return handleNoProfile(session.user);
    }

    setUser(profile);
    const viewState = determineViewState(profile);
    setViewState(viewState);

  } catch (e) {
    handleProfileError(session.user, e);
  } finally {
    setIsLoadingAuth(false);
  }
};

const determineViewState = (profile) => {
  const tempMode = sessionStorage.getItem('ojt_sessionMode');

  if (profile.role === 'admin') {
    if (tempMode === 'mentor') {
      setSessionMode('mentor');
      return 'mentor_dashboard';
    }
    return 'admin_dashboard';
  }

  const roleToView = {
    mentor: 'mentor_dashboard',
    mentee: 'mentee_list'
  };

  return roleToView[profile.role] || 'role_select';
};
```

---

### 12. 접근성: 키보드 네비게이션 부재

**심각도**: Low
**파일**: `index.html` (여러 위치)

**문제점**:
```javascript
// 모달 닫기: ESC 키 미지원
{showDocModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50">
    <button onClick={() => setShowDocModal(false)}>×</button>
  </div>
)}

// 드롭다운: 키보드로 선택 불가
<div className="mode-menu-container">
  <button onClick={() => setShowModeMenu(!showModeMenu)}>모드</button>
  {showModeMenu && (
    <div>
      <button onClick={() => handleModeSwitch('mentor')}>Mentor</button>
    </div>
  )}
</div>
```

**개선 권장**:
```javascript
// ESC 키로 모달 닫기
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && showDocModal) {
      setShowDocModal(false);
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [showDocModal]);

// 키보드 네비게이션
<div role="menu" aria-label="모드 전환">
  <button
    role="menuitem"
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleModeSwitch('mentor');
      }
    }}
  >
    Mentor 모드
  </button>
</div>
```

---

### 13. 성능: 불필요한 리렌더링

**심각도**: Low
**파일**: `index.html:944-2710`

**문제점**:
```javascript
function App() {
  const [user, setUser] = useState(null);
  const [viewState, setViewState] = useState('loading');
  const [sessionMode, setSessionMode] = useState(null);
  // ... 30개 이상의 state 변수

  // 모든 state가 변경될 때마다 전체 App 리렌더링
}
```

**개선 권장**:
```javascript
// Context로 분리
const UserContext = createContext();
const ViewStateContext = createContext();
const QuizContext = createContext();

function App() {
  return (
    <UserProvider>
      <ViewStateProvider>
        <QuizProvider>
          <RouterOutlet />
        </QuizProvider>
      </ViewStateProvider>
    </UserProvider>
  );
}

// useMemo로 최적화
const filteredDocs = useMemo(() => {
  return myDocs.filter(doc => doc.team === selectedTeam);
}, [myDocs, selectedTeam]);
```

---

### 14. 주석: 복잡한 로직 설명 부족

**심각도**: Low
**파일**: `index.html:842-862`

**문제점**:
```javascript
// JSON 문자열 정리 함수
function cleanJsonString(str) {
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  });
  str = str.replace(/\n/g, ' ').replace(/\r/g, '');
  str = str.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
  return str;
}
```

**개선 권장**:
```javascript
/**
 * Gemini API 응답의 잘못된 JSON 문자열을 정리합니다.
 *
 * @param {string} str - 정리할 JSON 문자열
 * @returns {string} 정리된 JSON 문자열
 *
 * 처리 단계:
 * 1. 제어 문자 제거 (탭/줄바꿈 제외)
 * 2. JSON 문자열 내부 줄바꿈을 이스케이프 시퀀스로 변환
 * 3. JSON 구조 밖의 줄바꿈 제거
 * 4. 잘못된 유니코드 이스케이프 수정
 */
function cleanJsonString(str) {
  // 1. 제어 문자 제거 (ASCII 0x00-0x1F, 0x7F 중 탭/줄바꿈 제외)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. 문자열 리터럴 내부의 실제 줄바꿈을 이스케이프 시퀀스로 변환
  // 정규식: "로 시작/끝나는 부분에서만 처리
  str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')   // LF → \n
      .replace(/\r/g, '\\r')   // CR → \r
      .replace(/\t/g, '\\t');  // TAB → \t
  });

  // 3. JSON 구조 밖의 줄바꿈 제거 (공백으로 치환)
  str = str.replace(/\n/g, ' ').replace(/\r/g, '');

  // 4. 잘못된 유니코드 이스케이프 수정 (\u 뒤에 4자리 16진수 없으면 \\u로 변환)
  str = str.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');

  return str;
}
```

---

### 15. 테스트: 단위 테스트 부재

**심각도**: Low
**파일**: 전체

**문제점**:
- `tests/e2e-homepage.spec.js`: E2E 테스트만 존재
- 유틸리티 함수, 데이터 매핑, AI 파싱 로직 등의 단위 테스트 없음

**개선 권장**:
```javascript
// tests/unit/utils.test.js
import { describe, test, expect } from 'vitest';
import { estimateReadingTime, calculateRequiredSteps } from '../utils/contentSplitter';

describe('Content Splitter Utils', () => {
  test('estimateReadingTime: 500자 = 1분', () => {
    const text = 'a'.repeat(500);
    expect(estimateReadingTime(text)).toBe(1);
  });

  test('calculateRequiredSteps: 20,000자 = 1 스텝', () => {
    const text = 'a'.repeat(20000);
    expect(calculateRequiredSteps(text)).toBe(1);
  });

  test('calculateRequiredSteps: 40,000자 = 2 스텝', () => {
    const text = 'a'.repeat(40000);
    expect(calculateRequiredSteps(text)).toBe(2);
  });
});
```

---

## 긍정적 측면

1. **일관된 Tailwind CSS 사용**: 클래스명 일관성 유지
2. **접근성 고려**: ARIA 레이블 일부 적용 (`role="menu"` 등)
3. **온라인/오프라인 처리**: Dexie.js 동기화 로직 우수
4. **Quill 에디터 통합**: 드래그&드롭, 붙여넣기 이미지 지원 우수
5. **R2 Worker 구조**: REST API 패턴 준수 (POST/PUT/DELETE/GET)

---

## 우선순위 개선 로드맵

### Phase 1: 보안 (즉시)
- [ ] Gemini API 키를 Supabase Edge Function으로 이동
- [ ] 환경 변수 설정 (Vercel + .env.local)

### Phase 2: 구조 개선 (1주)
- [ ] 컴포넌트 파일 분리 (최소 5개)
- [ ] 유틸리티 함수 분리 (constants, mappers, validators)
- [ ] Context API로 state 관리 개선

### Phase 3: UX 개선 (2주)
- [ ] `alert()` 제거 후 Toast 라이브러리 도입
- [ ] 키보드 네비게이션 추가
- [ ] 로딩 상태 UX 개선

### Phase 4: 품질 향상 (지속)
- [ ] 단위 테스트 작성 (커버리지 60% 이상)
- [ ] JSDoc 주석 추가
- [ ] ESLint + Prettier 설정

---

## 참고 자료

- [React Best Practices 2024](https://react.dev/learn)
- [Tailwind CSS Guide](https://tailwindcss.com/docs)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Cloudflare Workers Best Practices](https://developers.cloudflare.com/workers/)

---

**검토자**: Claude Code (claude-sonnet-4-5)
**다음 검토**: 2주 후 (Phase 1 완료 후)
