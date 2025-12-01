# 코드 리뷰: 로직 정확성 분석

**프로젝트**: OJT Master v2.2.0
**파일**: `D:\AI\claude01\ggp_ojt_v2\index.html`
**검토일**: 2025-12-01
**검토자**: Claude Code

---

## 요약

총 **13개의 이슈**를 발견했습니다:
- **Critical**: 3개
- **High**: 5개
- **Medium**: 3개
- **Low**: 2개

---

## Critical Issues (심각)

### 1. 퀴즈 배열 인덱스 경계 확인 부재

**심각도**: Critical
**위치**: `index.html:1707-1709`

**문제**:
```javascript
activeQuizSet.forEach((q, idx) => {
  if (selectedAnswers[idx] === q.answer) correctCount++;
});
```

`selectedAnswers`가 sparse array일 경우 `undefined`와 `0`의 비교 문제가 발생합니다. 정답이 인덱스 0인 경우, 사용자가 선택하지 않은 문제(`undefined`)와 구분되지 않습니다.

**영향**:
- 사용자가 첫 번째 선지(인덱스 0)를 선택했을 때 점수가 누락될 수 있음
- 퀴즈 미응답 시 정답으로 카운트될 위험

**수정 권장**:
```javascript
activeQuizSet.forEach((q, idx) => {
  // 명시적으로 선택 여부 확인 후 정답 비교
  if (selectedAnswers.hasOwnProperty(idx) && selectedAnswers[idx] === q.answer) {
    correctCount++;
  }
});
```

---

### 2. R2 이미지 삭제 시 URL 파싱 실패 처리 부재

**심각도**: Critical
**위치**: `index.html:234-238`

**문제**:
```javascript
async function deleteImageFromR2(imageUrl) {
  try {
    const urlParts = imageUrl.split('/');
    const key = urlParts.slice(-2).join('/'); // uploads/timestamp-random.ext
```

`imageUrl`이 `null`, `undefined`, 또는 잘못된 형식일 경우 파싱 실패로 인한 에러 발생. 또한 URL 구조가 예상과 다를 경우(`/uploads/` 경로가 없는 경우) 잘못된 key가 생성됩니다.

**영향**:
- 삭제 기능 전체 실패
- 잘못된 파일 삭제 가능성

**수정 권장**:
```javascript
async function deleteImageFromR2(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('유효하지 않은 이미지 URL입니다');
    }

    // URL에서 key 추출 - uploads/ 경로 검증
    const uploadMatch = imageUrl.match(/\/uploads\/(.+)$/);
    if (!uploadMatch) {
      throw new Error('R2 업로드 URL 형식이 아닙니다');
    }

    const key = 'uploads/' + uploadMatch[1];

    const response = await fetch(R2_WORKER_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
      throw new Error(error.error || '이미지 삭제 실패');
    }

    console.log('Image deleted from R2:', key);
    return true;
  } catch (error) {
    console.error('R2 delete error:', error);
    throw error; // 에러를 상위로 전파하여 호출자가 처리하도록
  }
}
```

---

### 3. 퀴즈 20개 미만 시 더미 생성 로직의 무한 루프 위험

**심각도**: Critical
**위치**: `index.html:923-931`

**문제**:
```javascript
while (result.quiz && result.quiz.length < 20) {
  result.quiz.push({
    id: result.quiz.length + 1,
    question: `${result.title} 관련 추가 문제 ${result.quiz.length + 1}`,
    options: ["정답", "오답1", "오답2", "오답3"],
    answer: 0
  });
}
```

`result.quiz`가 `null` 또는 `undefined`일 경우 조건문을 통과하지만, `result.quiz.push()`에서 에러 발생. 또한 `result.quiz`가 배열이 아닌 객체일 경우 무한 루프 가능성이 있습니다.

**영향**:
- 앱 프리징
- AI 응답 파싱 실패 시 사용자 경험 저하

**수정 권장**:
```javascript
// quiz 필드 초기화 및 검증
if (!Array.isArray(result.quiz)) {
  console.warn('Quiz is not an array, initializing empty array');
  result.quiz = [];
}

// 20개로 채우기 (안전 장치: 최대 20번 반복)
const maxIterations = 20;
let iterations = 0;
while (result.quiz.length < 20 && iterations < maxIterations) {
  result.quiz.push({
    id: result.quiz.length + 1,
    question: `${result.title || '문서'} 관련 추가 문제 ${result.quiz.length + 1}`,
    options: ["정답", "오답1", "오답2", "오답3"],
    answer: 0
  });
  iterations++;
}

if (result.quiz.length < 20) {
  console.error('Failed to generate 20 quiz questions');
}
```

---

## High Issues (높음)

### 4. 스텝 분할 시 빈 세그먼트 필터링 후 개수 불일치

**심각도**: High
**위치**: `index.html:283-323`

**문제**:
```javascript
function splitContentForSteps(text, numSteps) {
  if (numSteps <= 1) return [text];

  const segments = [];
  // ... 분할 로직 ...

  return segments.filter(s => s.length > 0); // 빈 세그먼트 제거
}
```

분할 로직 중 빈 세그먼트가 생성되어 필터링되면, 반환되는 배열의 길이가 `numSteps`와 일치하지 않을 수 있습니다. 호출자(`handleGenerate`)는 `segments.length`를 신뢰하므로 UI 표시 불일치 가능성이 있습니다.

**영향**:
- "3개 스텝으로 분할 중..." 표시 후 실제로 2개만 생성
- 스텝 번호 불일치

**수정 권장**:
```javascript
function splitContentForSteps(text, numSteps) {
  if (numSteps <= 1 || !text || text.trim().length === 0) {
    return [text || ''];
  }

  const segments = [];
  const avgLength = Math.ceil(text.length / numSteps);

  // ... 분할 로직 ...

  // 빈 세그먼트 필터링
  const filtered = segments.filter(s => s && s.trim().length > 0);

  // 예상 개수와 다르면 경고
  if (filtered.length !== numSteps) {
    console.warn(`Expected ${numSteps} segments, but got ${filtered.length}`);
  }

  // 최소 1개는 반환
  return filtered.length > 0 ? filtered : [text];
}
```

---

### 5. Gemini API 응답 파싱 시 중첩된 try-catch의 에러 처리 불명확

**심각도**: High
**위치**: `index.html:865-921`

**문제**:
```javascript
let result;
try {
  const cleanedJson = cleanJsonString(jsonStr);
  result = JSON.parse(cleanedJson);
} catch (parseError) {
  console.error("JSON Parse Error:", parseError.message);

  // 수동 파싱 시도
  try {
    const titleMatch = cleanedResponse.match(/"title"\s*:\s*"([^"]+)"/);
    // ... regex 파싱 ...
    result = { title: title, sections: sections.length > 0 ? sections : [...], quiz: quiz };
  } catch (regexError) {
    console.error("Regex parsing also failed:", regexError);
    result = {
      title: "생성 실패",
      sections: [{ title: "오류", content: "AI 응답을 파싱하지 못했습니다. 다시 시도해주세요." }],
      quiz: []
    };
  }
}
```

Regex 파싱도 실패했을 때 생성되는 기본 객체의 `quiz`가 빈 배열입니다. 이후 923줄의 더미 생성 로직으로 20개를 채우게 되는데, 실제 AI 콘텐츠가 아닌 "정답/오답1/오답2/오답3"만 포함된 무의미한 퀴즈가 생성됩니다.

**영향**:
- 사용자가 의미 없는 퀴즈로 평가받음
- 교육 자료로서의 가치 상실

**수정 권장**:
```javascript
} catch (regexError) {
  console.error("Regex parsing also failed:", regexError);
  // 파싱 완전 실패 시 에러를 상위로 전파
  throw new Error('AI 응답을 파싱하지 못했습니다. 다시 시도해주세요.');
}

// 외부 try-catch에서 처리
} catch (error) {
  console.error("AI Generation Error:", error);
  throw error; // handleGenerate에서 alert으로 표시됨
}
```

---

### 6. 학습 시간 추정 함수의 0 반환 처리 부재

**심각도**: High
**위치**: `index.html:268-272`

**문제**:
```javascript
function estimateReadingTime(text) {
  if (!text) return 0;
  const charCount = text.length;
  return Math.ceil(charCount / CHARS_PER_MINUTE);
}
```

빈 문자열이거나 공백만 있는 경우 `0`을 반환합니다. 이 값은 UI에 표시되거나 `calculateRequiredSteps`에 영향을 줄 수 있습니다.

**영향**:
- "예상 학습 시간: 0분" 표시로 사용자 혼란
- 0분 콘텐츠를 생성하려는 시도

**수정 권장**:
```javascript
function estimateReadingTime(text) {
  if (!text || typeof text !== 'string') return 0;

  const trimmedText = text.trim();
  if (trimmedText.length === 0) return 0;

  const charCount = trimmedText.length;
  const minutes = Math.ceil(charCount / CHARS_PER_MINUTE);

  // 최소 1분으로 설정 (너무 짧은 콘텐츠 방지)
  return Math.max(1, minutes);
}
```

---

### 7. 오프라인 동기화 큐 처리 시 재시도 카운트 무한 증가 가능성

**심각도**: High
**위치**: `index.html:344-372`

**문제**:
```javascript
const processSyncQueue = async () => {
  const queue = await localDb.sync_queue.toArray();

  for (const item of queue) {
    try {
      if (item.action === 'upsert') {
        await supabase.from(item.table).upsert(item.data);
      } else if (item.action === 'insert') {
        await supabase.from(item.table).insert(item.data);
      } else if (item.action === 'delete') {
        await supabase.from(item.table).delete().eq('id', item.data.id);
      }
      await localDb.sync_queue.delete(item.id);
    } catch (e) {
      console.error('Sync queue processing failed:', e);
      const retryCount = (item.retryCount || 0) + 1;
      if (retryCount >= MAX_SYNC_RETRIES) {
        console.error(`Sync item permanently failed after ${MAX_SYNC_RETRIES} retries:`, item);
        await localDb.sync_queue.delete(item.id);
      } else {
        await localDb.sync_queue.update(item.id, { retryCount });
      }
    }
  }
};
```

`window.addEventListener('online')`이 여러 번 발생하거나, 사용자가 수동으로 여러 번 호출할 경우 동시에 여러 `processSyncQueue`가 실행될 수 있습니다. 이 경우 동일한 아이템에 대해 중복 처리가 발생할 수 있습니다.

**영향**:
- 데이터 중복 삽입
- RLS 정책 위반으로 인한 실패 증가

**수정 권장**:
```javascript
let isProcessingSyncQueue = false; // 플래그 추가

const processSyncQueue = async () => {
  if (isProcessingSyncQueue) {
    console.log('Sync queue already processing, skipping...');
    return;
  }

  isProcessingSyncQueue = true;

  try {
    const queue = await localDb.sync_queue.toArray();

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          await supabase.from(item.table).upsert(item.data);
        } else if (item.action === 'insert') {
          await supabase.from(item.table).insert(item.data);
        } else if (item.action === 'delete') {
          await supabase.from(item.table).delete().eq('id', item.data.id);
        }
        await localDb.sync_queue.delete(item.id);
      } catch (e) {
        console.error('Sync queue processing failed:', e);
        const retryCount = (item.retryCount || 0) + 1;
        if (retryCount >= MAX_SYNC_RETRIES) {
          console.error(`Sync item permanently failed after ${MAX_SYNC_RETRIES} retries:`, item);
          await localDb.sync_queue.delete(item.id);
        } else {
          await localDb.sync_queue.update(item.id, { retryCount });
        }
      }
    }
  } finally {
    isProcessingSyncQueue = false;
  }
};
```

---

### 8. dbGetAll 필터링 시 캐시 클리어 조건의 논리적 오류

**심각도**: High
**위치**: `index.html:464-467`

**문제**:
```javascript
if (data && !error) {
  // 캐시 완전 교체 (삭제된 데이터 정리)
  // 필터가 없는 전체 조회일 때만 clear 수행
  if (!filters.team && !filters.authorId && !filters.userId) {
    await localDb[storeName].clear();
  }
  await localDb[storeName].bulkPut(data);
}
```

필터가 있는 경우 `clear()`를 하지 않고 `bulkPut()`만 수행하므로, 서버에서 삭제된 데이터가 로컬 캐시에 남아있게 됩니다. 또한 `bulkPut()`은 기존 데이터를 업데이트하므로, 필터 조건에 해당하지 않는 캐시 데이터는 유지됩니다.

**영향**:
- 삭제된 문서가 캐시에 남아 UI에 표시됨
- 데이터 일관성 문제

**수정 권장**:
```javascript
if (data && !error) {
  if (!filters.team && !filters.authorId && !filters.userId) {
    // 전체 조회: 캐시 완전 교체
    await localDb[storeName].clear();
    await localDb[storeName].bulkPut(data);
  } else {
    // 필터 조회: 기존 캐시 유지하되 서버 데이터로 업데이트만 수행
    // 삭제 처리를 위해서는 서버 응답과 비교 필요
    const serverIds = new Set(data.map(item => item.id));

    // 캐시에서 필터에 해당하는 데이터 가져오기
    let cachedFiltered = [];
    if (storeName === "ojt_docs" && filters.team) {
      cachedFiltered = await localDb.ojt_docs.where('team').equals(filters.team).toArray();
    } else if (storeName === "learning_records" && filters.userId) {
      cachedFiltered = await localDb.learning_records.where('user_id').equals(filters.userId).toArray();
    }

    // 서버에 없는 캐시 항목 삭제 (서버에서 삭제된 경우)
    for (const cached of cachedFiltered) {
      if (!serverIds.has(cached.id)) {
        await localDb[storeName].delete(cached.id);
      }
    }

    // 서버 데이터 반영
    await localDb[storeName].bulkPut(data);
  }
}
```

---

## Medium Issues (중간)

### 9. 문서 편집 시 첫 번째 문서만 업데이트되는 로직

**심각도**: Medium
**위치**: `index.html:1577-1589`

**문제**:
```javascript
for (const doc of docsToSave) {
  const docToSave = { /* ... */ };

  // 편집 모드: 기존 문서 업데이트
  if (editingDoc && savedCount === 0) {
    docToSave.id = editingDoc.id;
    docToSave.createdAt = editingDoc.createdAt;
    docToSave.updatedAt = Date.now();
    await dbPut("ojt_docs", docToSave);
  } else {
    // 신규 모드: 새 문서 추가
    docToSave.createdAt = Date.now() + savedCount;
    await dbAdd("ojt_docs", docToSave);
  }
  savedCount++;
}
```

자동 분할로 여러 문서를 생성했을 때, 편집 모드에서는 첫 번째 문서만 업데이트하고 나머지는 새로 추가합니다. 이는 원래 의도와 다를 수 있습니다.

**영향**:
- 편집 후 문서가 중복 생성됨
- 사용자 혼란

**수정 권장**:
```javascript
// 편집 모드에서는 자동 분할을 비활성화하거나
// 여러 문서 편집 시 경고 표시
if (editingDoc && docsToSave.length > 1) {
  if (!confirm(`편집 중인 문서를 ${docsToSave.length}개로 분할하여 저장하시겠습니까? 기존 문서는 첫 번째로 업데이트되고, 나머지는 새로 생성됩니다.`)) {
    return;
  }
}
```

---

### 10. URL 텍스트 추출 시 15,000자 제한의 자동 절단

**심각도**: Medium
**위치**: `index.html:691-694`

**문제**:
```javascript
// 최대 15000자로 제한
if (text.length > 15000) {
  text = text.substring(0, 15000) + '...\n\n[내용이 너무 길어 일부만 추출되었습니다]';
}
```

사용자에게 경고 없이 콘텐츠가 잘립니다. 잘린 상태로 AI 생성 시 불완전한 교육 자료가 생성될 수 있습니다.

**영향**:
- 사용자가 콘텐츠 누락을 인지하지 못함
- 중요한 부분이 잘려나갈 수 있음

**수정 권장**:
```javascript
// 최대 15000자로 제한
if (text.length > 15000) {
  const confirmTruncate = confirm(
    `추출된 텍스트가 ${text.length.toLocaleString()}자로 너무 깁니다.\n` +
    `15,000자로 제한하고 계속하시겠습니까?\n\n` +
    `(전체 내용을 사용하려면 PDF로 저장하거나 복사하여 직접 입력하세요.)`
  );

  if (!confirmTruncate) {
    throw new Error('사용자가 텍스트 절단을 취소했습니다');
  }

  text = text.substring(0, 15000) + '\n\n[내용이 너무 길어 15,000자로 제한되었습니다]';
}
```

---

### 11. 퀴즈 셔플 알고리즘의 Fisher-Yates 구현 검증 부재

**심각도**: Medium
**위치**: `index.html:1686-1690`

**문제**:
```javascript
const fullPool = [...selectedDoc.quiz];
for (let i = fullPool.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [fullPool[i], fullPool[j]] = [fullPool[j], fullPool[i]];
}
setActiveQuizSet(fullPool.slice(0, 4));
```

Fisher-Yates 알고리즘은 올바르게 구현되었으나, `selectedDoc.quiz`의 길이가 4 미만일 경우를 검증하지 않습니다.

**영향**:
- AI 생성 실패로 퀴즈가 4개 미만일 때 더 적은 문제 출제
- 통과 기준(3/4) 달성 불가

**수정 권장**:
```javascript
const startQuizSession = () => {
  if (!selectedDoc || !selectedDoc.quiz || !Array.isArray(selectedDoc.quiz)) {
    alert('퀴즈 데이터가 없습니다.');
    return;
  }

  if (selectedDoc.quiz.length < 4) {
    alert(`퀴즈 문제가 ${selectedDoc.quiz.length}개뿐입니다. 최소 4개가 필요합니다.`);
    return;
  }

  const fullPool = [...selectedDoc.quiz];
  for (let i = fullPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fullPool[i], fullPool[j]] = [fullPool[j], fullPool[i]];
  }
  setActiveQuizSet(fullPool.slice(0, 4));
  setQuizMode(true);
  setSelectedAnswers({});
  setQuizSubmitted(false);
  setCurrentQuizIndex(0);
  setScore(0);
  setPassed(false);
};
```

---

## Low Issues (낮음)

### 12. crypto.randomUUID() 브라우저 호환성 미체크

**심각도**: Low
**위치**: `index.html:539`

**문제**:
```javascript
const newId = crypto.randomUUID();
```

`crypto.randomUUID()`는 비교적 최신 API로, 구형 브라우저에서 지원되지 않을 수 있습니다.

**영향**:
- 구형 브라우저에서 앱 실행 불가
- 하지만 Supabase Client도 최신 브라우저 요구하므로 실제 영향은 제한적

**수정 권장**:
```javascript
// Polyfill 추가 (앱 초기화 부분에)
if (!crypto.randomUUID) {
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}
```

---

### 13. Quill 에디터 초기화 시 이미지 핸들러 중복 등록 가능성

**심각도**: Low
**위치**: `index.html:1105-1195` (추정, 코드 미확인)

**문제**:
`useEffect`에서 Quill 에디터를 초기화할 때, 의존성 배열이 없거나 부적절하면 이미지 핸들러가 여러 번 등록될 수 있습니다.

**영향**:
- 이미지 업로드 시 중복 요청
- 메모리 누수

**수정 권장**:
```javascript
useEffect(() => {
  if (inputType === 'text' && quillRef.current && !quillInstanceRef.current) {
    const quill = new Quill(quillRef.current, {
      theme: 'snow',
      modules: {
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ],
          handlers: {
            image: handleQuillImageUpload
          }
        }
      }
    });

    // 드래그 앤 드롭 및 붙여넣기 핸들러 등록
    const editor = quill.root;
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('paste', handlePaste);

    quillInstanceRef.current = quill;

    // Cleanup 함수 추가
    return () => {
      editor.removeEventListener('drop', handleDrop);
      editor.removeEventListener('paste', handlePaste);
      quillInstanceRef.current = null;
    };
  }
}, [inputType]); // 의존성 배열 명시
```

---

## 추가 권장 사항

### 1. 에러 바운더리 추가
React 앱에 Error Boundary를 추가하여 예상치 못한 에러로 인한 앱 크래시 방지

### 2. 입력 검증 강화
- Team, Step 선택 시 유효성 검증
- 제목 길이 제한 (DB 스키마와 일치)
- 섹션 개수 제한 (너무 많으면 UI 성능 저하)

### 3. 로딩 상태 개선
- AI 생성 중 취소 기능 추가 (AbortController 사용)
- 타임아웃 설정 (Gemini API 응답 대기 시간 제한)

### 4. 데이터 일관성 검증
- 저장 전 quiz.answer 인덱스가 options 범위 내인지 검증
- sections 배열이 비어있지 않은지 검증

### 5. 접근성 개선
- 퀴즈 제출 시 키보드 포커스 관리
- ARIA 레이블 추가

---

## 테스트 권장 시나리오

1. **퀴즈 엣지 케이스**
   - 정답이 인덱스 0인 문제 응시
   - 문제를 선택하지 않고 제출
   - AI가 퀴즈를 0개 생성한 경우

2. **스텝 분할**
   - 매우 짧은 텍스트(100자 미만) 분할 시도
   - 매우 긴 텍스트(100,000자) 분할 시도
   - 공백만 있는 텍스트 분할

3. **R2 이미지 업로드**
   - 10MB 초과 파일 업로드
   - 잘못된 형식(txt, exe) 업로드
   - 네트워크 오류 시 재시도

4. **오프라인 동기화**
   - 오프라인 상태에서 여러 문서 생성 후 온라인 복귀
   - 동기화 실패 시 재시도 3회 초과
   - 온라인/오프라인 반복 전환

5. **동시성**
   - 여러 탭에서 동시 로그인
   - 동일 문서 동시 편집
   - 동시 퀴즈 제출

---

## 결론

**주요 개선 필요 사항**:
1. **Critical 이슈 3개 즉시 수정 필요** (퀴즈 점수 계산, R2 삭제, 더미 퀴즈 생성)
2. **High 이슈 5개 우선 순위로 수정** (스텝 분할, AI 파싱, 동기화 큐)
3. 전반적인 에러 처리 및 엣지 케이스 검증 강화

**코드 품질 평가**: 6.5/10
- 기본 기능은 잘 작동하나, 엣지 케이스 처리가 부족함
- 에러 처리가 일부 있으나 일관성 부족
- 동기화 로직이 복잡하여 버그 발생 가능성 높음

**보안 평가**: 7/10
- RLS 정책 적용됨 (Supabase)
- API 키가 클라이언트에 노출되나 HTTP Referer 제한 설정됨
- XSS 방지를 위한 Quill 에디터 사용

---

**검토 완료일**: 2025-12-01
**다음 검토 권장**: Critical/High 이슈 수정 후
