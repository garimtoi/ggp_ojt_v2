# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OJT Master - AI 기반 신입사원 온보딩 교육 자료 생성 및 학습 관리 시스템 (v2.2.0)

## Tech Stack

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18 (CDN, 단일 파일 SPA) |
| **Backend/DB** | Supabase (PostgreSQL + Auth) |
| **Local Cache** | Dexie.js (IndexedDB) |
| **AI** | Google Gemini API (gemini-2.0-flash-exp) |
| **Image Storage** | Cloudflare R2 (Worker 프록시) |
| **Editor** | Quill 2.0 (Rich Text) |
| **Hosting** | Vercel |

## Commands

```bash
# 메인 앱 - 로컬 개발 서버
npx serve . -p 3000

# E2E 테스트 (Playwright)
npm test                                    # 전체 테스트 실행
npm run test:headed                         # 브라우저 화면 보면서 실행
npm run test:ui                             # Playwright UI 모드
npx playwright test tests/e2e-homepage.spec.js  # 단일 테스트 파일
npm run test:report                         # HTML 리포트 보기

# R2 Worker (ojt-r2-upload/ 디렉토리에서)
cd ojt-r2-upload && npm run dev             # 로컬 개발 (wrangler)
cd ojt-r2-upload && npm run deploy          # Cloudflare 배포
cd ojt-r2-upload && npm test                # Vitest 테스트
```

> **주의**: `playwright.config.js`의 `baseURL`을 로컬 서버 포트에 맞게 수정 필요

## Architecture

단일 `index.html` 파일에 모든 React 코드가 포함된 SPA 구조:

```text
index.html (전체 앱)
├── Supabase 초기화 (Auth + PostgreSQL)
├── Dexie.js 초기화 (로컬 캐시 + 오프라인 큐)
├── 콘텐츠 추출: extractPdfText(), extractUrlText()
├── AI 생성: generateOJTContent(), checkAIStatus()
├── 자동 분할: splitContentForSteps(), calculateRequiredSteps()
├── R2 업로드: uploadImageToR2(), handleQuillImageDrop()
├── 캐시 관리: clearAllCache(), processSyncQueue()
└── App 컴포넌트
    ├── Google OAuth 인증
    ├── 역할 기반 뷰 분기 (Admin/Mentor/Mentee)
    ├── AdminDashboard (사용자/콘텐츠 관리, 통계)
    ├── MentorDashboard (자료 생성 + Quill 에디터)
    ├── MenteeList (팀별 로드맵 탐색)
    └── MenteeStudy (학습 + 퀴즈)
```

## Data Structure

### Supabase (PostgreSQL)

```sql
-- users: 사용자 프로필
users (id UUID PK, name, role, department, created_at, updated_at)

-- ojt_docs: OJT 문서
ojt_docs (id UUID PK, title, team, step, sections JSONB, quiz JSONB, author_id, author_name, estimated_minutes, created_at, updated_at)

-- learning_records: 학습 기록
learning_records (id UUID PK, user_id, doc_id, score, total_questions, passed, completed_at)
```

RLS 정책: `supabase_schema.sql`, `supabase_fix_rls.sql` 참조

### 확장 스키마 (v2.1.0)

```sql
-- learning_progress: 학습 진행률 추적 ✅ Phase 2 완료
learning_progress (id UUID PK, user_id FK, doc_id FK, status, current_section, total_time_seconds, quiz_attempts, best_score)

-- teams: 팀 마스터 ✅ Phase 3 완료
teams (id UUID PK, name, slug, display_order, is_active)
-- ojt_docs.team_id FK 추가됨

-- notifications: 알림 - Phase 4 예정
notifications (id UUID PK, user_id FK, type, title, message, is_read)
```

자세한 마이그레이션 가이드: [docs/DB_MIGRATION_GUIDE.md](docs/DB_MIGRATION_GUIDE.md)

### Dexie.js (로컬 캐시)

```javascript
localDb.version(1).stores({
  users: 'id, name, role',
  ojt_docs: 'id, team, step, author_id, updated_at',
  learning_records: 'id, user_id, doc_id',
  sync_queue: '++id, table, action, created_at'
});
```

## Role-Based Access

| 역할 | 권한 |
|------|------|
| **Admin** | 전체 사용자/콘텐츠 관리, 역할 변경, 통계 대시보드, Mentor 모드 전환 |
| **Mentor** | 비정형 텍스트 → AI 변환 → Supabase 저장, 자료 CRUD |
| **Mentee** | 팀별 로드맵 탐색 → 문서 학습 → 퀴즈 평가 (읽기 전용) |

**Admin 모드 전환**: Header의 "모드" 버튼으로 Mentor 작업실 전환 가능. `sessionStorage`로 세션 유지.

## Sync Strategy (Online-First, Offline-Ready)

| 작업 | 흐름 |
|------|------|
| **READ** | Dexie 캐시 → (온라인) Supabase 동기화 |
| **WRITE** | Dexie 저장 → (온라인) Supabase / (오프라인) 큐잉 |
| **DELETE** | Dexie 삭제 → (온라인) Supabase / (오프라인) 큐잉 |

오프라인 큐는 `window.addEventListener('online')` 이벤트로 자동 처리

## Error Handling

### 에러 복구 전략

| 영역 | 전략 | 설명 |
|------|------|------|
| **Gemini API 응답** | Regex fallback | JSON 파싱 실패 시 정규식으로 필드 추출 |
| **퀴즈 부족** | 더미 생성 | 20개 미만 시 자동 채움 |
| **CORS 차단** | 다중 프록시 | allorigins.win, corsproxy.io 순차 시도 |
| **오프라인 동기화** | 재시도 + 폐기 | 3회 실패 시 큐에서 제거 |

### 사용자 피드백

- `alert()`: 로그인 오류, 저장 오류, 생성 오류
- `console.error()`: 상세 디버그 로그

## AI Content Generation

Google Gemini API를 사용한 클라우드 기반 AI 콘텐츠 생성:

프롬프트: 10년 경력 기업 교육 설계 전문가 역할
- 섹션 구조: 학습 목표 → 핵심 내용 → 실무 예시 → 주의사항
- 퀴즈: 기억형 40% / 이해형 35% / 적용형 25%
- 파라미터: temperature=0.3, maxOutputTokens=8192

**장점**: 클라우드 API로 로컬/웹 배포 환경 모두에서 AI 기능 사용 가능

## CORS Proxies

URL 콘텐츠 추출 시 사용하는 프록시 목록 (순차 시도):
1. `https://api.allorigins.win/raw?url=`
2. `https://corsproxy.io/?`

**제한사항**:
- 최대 추출 문자: 15,000자
- 일부 사이트는 차단될 수 있음

## Deployment

| 환경 | URL | AI 기능 |
|------|-----|---------|
| **Production** | https://ggp-ojt-v2.vercel.app | Gemini API 사용 가능 |
| **Local** | http://localhost:3000 | Gemini API 사용 가능 |

- **Branch**: main (Vercel 자동 배포)
- **Supabase Auth**: Google OAuth
- **AI**: Google Gemini API (무료 티어)

> **중요**: 이 프로젝트는 Vercel에 연동되어 있어 main 브랜치 push 시 자동 배포됩니다.
> **코드 수정 또는 이슈 해결 후 반드시 커밋 & 푸시하세요.**

## Project Structure

```text
ggp_ojt_v2/
├── index.html                    # 전체 앱 (단일 파일 SPA)
├── supabase_*.sql                # DB 스키마 및 마이그레이션 파일들
├── playwright.config.js          # E2E 테스트 설정
├── docs/
│   ├── DB_MIGRATION_GUIDE.md     # DB 마이그레이션 가이드
│   └── r2-setup-guide.md         # R2 설정 가이드
├── tests/
│   ├── e2e-homepage.spec.js      # 홈페이지 E2E 테스트
│   └── e2e-admin-mode.spec.js    # Admin 모드 E2E 테스트
└── ojt-r2-upload/                # Cloudflare R2 Worker 프로젝트
    ├── src/index.js              # Worker 핸들러 (upload/delete/get)
    └── wrangler.jsonc            # Cloudflare 설정
```

## Known Issues (2025-12-01 코드 리뷰)

> 상세 내용: `TODO.md`, `CODE_REVIEW_*.md`, `PERFORMANCE_ANALYSIS.md` 참조

### Critical (즉시 수정 필요)

| 이슈 | 위치 | 설명 |
|------|------|------|
| API 키 노출 | `index.html:106-108, 160` | Gemini API 키 하드코딩 → Edge Function 프록시 필요 |
| XSS 취약점 | `index.html:1478` | Quill HTML 미검증 → DOMPurify 필요 |
| 퀴즈 점수 버그 | 퀴즈 로직 | 정답 인덱스 0일 때 오답 처리 |
| 무한 루프 위험 | 퀴즈 더미 | `result.quiz` 배열 검증 부재 |

### High (1주 내 수정)

- **보안**: 파일 업로드 매직 넘버 미검증, URL SSRF, 역할 변경 감사 로그 없음
- **로직**: 스텝 분할 불일치, AI 파싱 실패 처리, 동기화 큐 중복
- **성능**: Quill 메모리 누수, 불필요한 리렌더링, 중복 API 호출
- **구조**: 2,710줄 단일 파일, alert() 남용, 매직 넘버

### 코드 품질 점수: 62/100

| 분류 | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Security | 1 | 5 | 6 | 2 |
| Logic | 2 | 5 | 4 | 2 |
| Style | 0 | 4 | 6 | 2 |
| Performance | 0 | 8 | 12 | 8 |

## Development Notes

### 작업 시 주의사항

1. **API 키**: 현재 클라이언트에 노출됨. 새 기능 추가 시 Edge Function 사용 권장
2. **XSS**: 사용자 입력 HTML 사용 시 반드시 DOMPurify 적용
3. **퀴즈 로직**: 인덱스 0 처리 주의 (`hasOwnProperty` 사용)
4. **단일 파일**: 수정 시 함수 위치 파악 어려움. 향후 파일 분리 예정