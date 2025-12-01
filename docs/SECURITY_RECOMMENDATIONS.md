# 보안 권장사항

> OJT Master 프로젝트 보안 감사 결과 (2025-12-01)

## 개요

| 심각도 | 개수 | OWASP Top 10 |
|--------|------|--------------|
| Critical | 1 | A02, A05 |
| High | 5 | A01, A03, A04, A07 |
| Medium | 6 | A01, A03, A05, A07, A10 |
| Low | 2 | A04, A05 |

---

## 1. Critical: API 키 노출

### 현재 상태
```javascript
// index.html:106-108, 160
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
const GEMINI_API_KEY = "AIzaSy...";
```

### 위험
- 브라우저 개발자 도구/GitHub에서 누구나 확인 가능
- Gemini API 무단 사용 → 비용 폭탄
- Supabase RLS 우회 가능성

### 해결책

#### Step 1: Supabase Edge Function 생성

```bash
# Supabase CLI 설치
npm install -g supabase

# Edge Function 생성
supabase functions new generate-ojt-content
```

```typescript
// supabase/functions/generate-ojt-content/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

serve(async (req) => {
  const { contentText, numSteps } = await req.json()

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `프롬프트: ${contentText}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
      })
    }
  )

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

#### Step 2: 환경 변수 설정

```bash
# Supabase secrets
supabase secrets set GEMINI_API_KEY=your_api_key

# Vercel 환경 변수 (필요시)
vercel env add VITE_SUPABASE_URL
```

#### Step 3: 클라이언트 코드 수정

```javascript
// Before
const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, ...);

// After
const { data, error } = await supabase.functions.invoke('generate-ojt-content', {
  body: { contentText, numSteps }
});
```

---

## 2. High: XSS 취약점

### 현재 상태
```javascript
// index.html:1478
const html = quillInstanceRef.current.root.innerHTML;
contentText = hasFormatting ? html : plainText;
```

### 위험
- `<script>alert(document.cookie)</script>` 삽입 시 실행
- 세션 탈취, 악성 행동 가능

### 해결책

```html
<!-- DOMPurify 추가 -->
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
```

```javascript
// HTML Sanitization
const ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'blockquote', 'pre', 'code', 'a', 'img'];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class'];

const html = quillInstanceRef.current.root.innerHTML;
const sanitizedHtml = DOMPurify.sanitize(html, {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false
});
```

---

## 3. High: 파일 업로드 검증

### 현재 상태
```javascript
// ojt-r2-upload/src/index.js:49-54
if (!ALLOWED_TYPES.includes(contentType)) { ... }
```

### 위험
- Content-Type 헤더 조작 가능
- 악성 파일을 이미지로 위장

### 해결책

```javascript
// 매직 넘버 검증
async function validateImageFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'image/webp': [0x52, 0x49, 0x46, 0x46]
  };

  for (const [type, sig] of Object.entries(signatures)) {
    if (sig.every((byte, i) => bytes[i] === byte)) {
      return type;
    }
  }

  throw new Error('유효하지 않은 이미지 파일');
}
```

---

## 4. High: URL 입력 SSRF

### 현재 상태
```javascript
// index.html:644-668
const corsProxies = [
  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ...
];
```

### 위험
- `http://localhost:8080/admin` 입력 시 내부 서비스 노출
- AWS 메타데이터 (`169.254.169.254`) 접근 가능

### 해결책

```javascript
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  '169.254.169.254', '::1', 'metadata.google.internal'
];

function validateUrl(urlString) {
  const url = new URL(urlString);

  // 프로토콜 검증
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('http/https만 허용');
  }

  // 내부 IP 차단
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some(h => hostname.includes(h))) {
    throw new Error('내부 네트워크 차단');
  }

  // Private IP 범위 차단
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [_, a, b] = ipMatch.map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new Error('Private IP 차단');
    }
  }

  return true;
}
```

---

## 5. High: 역할 변경 감사 로그

### 현재 상태
- 역할 변경 시 기록 없음
- Admin 계정 탈취 시 추적 불가

### 해결책

```sql
-- audit_logs 테이블
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 역할 변경 트리거
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (event_type, table_name, record_id, old_value, new_value, performed_by)
    VALUES ('UPDATE_ROLE', 'users', NEW.id,
            jsonb_build_object('role', OLD.role),
            jsonb_build_object('role', NEW.role),
            auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_user_role_change
  AFTER UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION log_role_change();
```

---

## 6. Medium: OAuth Redirect URI

### 현재 상태
```javascript
redirectTo: window.location.origin
```

### 해결책

```javascript
const ALLOWED_ORIGINS = [
  'https://ggp-ojt-v2.vercel.app',
  'http://localhost:3000'
];

const redirectOrigin = ALLOWED_ORIGINS.includes(window.location.origin)
  ? window.location.origin
  : 'https://ggp-ojt-v2.vercel.app';
```

**Supabase 설정**: Dashboard → Authentication → URL Configuration에서 화이트리스트 설정

---

## 7. Medium: CSRF 방어 강화

### 현재 상태
```javascript
if (!confirm('정말로 삭제하시겠습니까?')) return;
```

### 해결책

```javascript
const handleDeleteDoc = async (docId) => {
  // 1차 확인
  if (!confirm('정말로 삭제하시겠습니까?')) return;

  // 2차 확인: 제목 입력
  const doc = allDocs.find(d => d.id === docId);
  const userInput = prompt(`삭제하려면 문서 제목을 입력하세요:\n"${doc.title}"`);

  if (userInput !== doc.title) {
    alert('제목이 일치하지 않습니다.');
    return;
  }

  // 삭제 진행
  await supabase.from('ojt_docs').delete().eq('id', docId);
};
```

---

## 보안 체크리스트

### 배포 전 필수
- [ ] API 키 환경 변수 이동
- [ ] DOMPurify 통합
- [ ] 파일 업로드 매직 넘버 검증
- [ ] URL 입력 SSRF 방어

### 주기적 점검
- [ ] npm audit 실행
- [ ] Supabase RLS 정책 검토
- [ ] 감사 로그 확인
- [ ] API 사용량 모니터링

### 참고 자료
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Supabase Security](https://supabase.com/docs/guides/auth/row-level-security)
- [DOMPurify](https://github.com/cure53/DOMPurify)
