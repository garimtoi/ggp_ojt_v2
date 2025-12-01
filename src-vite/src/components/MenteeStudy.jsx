// OJT Master v2.3.0 - Mentee Study Component

import { useState, useMemo, useEffect } from 'react';
import { useDocs } from '../contexts/DocsContext';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../contexts/ToastContext';
import { supabase } from '../utils/api';
import { sanitizeHtml, shuffleArray } from '../utils/helpers';
import { CONFIG, VIEW_STATES } from '../constants';

export default function MenteeStudy() {
  const { selectedDoc, setSelectedDoc } = useDocs();
  const { user, setViewState } = useAuth();

  // Study state
  const [currentSection, setCurrentSection] = useState(0);
  const [studyCompleted, setStudyCompleted] = useState(false);

  // Quiz state
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Prepare quiz questions when entering quiz mode
  const prepareQuiz = () => {
    if (!selectedDoc?.quiz || selectedDoc.quiz.length === 0) {
      Toast.warning('이 문서에는 퀴즈가 없습니다.');
      return;
    }

    // Shuffle and pick 4 questions
    const shuffled = shuffleArray([...selectedDoc.quiz]);
    const selected = shuffled.slice(0, CONFIG.QUIZ_QUESTIONS_PER_TEST);

    // Normalize quiz format and shuffle answers
    const prepared = selected.map((q) => {
      // AI generates "correct" index, convert to "answer" string
      const correctAnswer = q.answer || q.options[q.correct] || q.options[0];

      return {
        ...q,
        answer: correctAnswer,
        shuffledOptions: shuffleArray([...q.options]),
      };
    });

    setQuizQuestions(prepared);
    setCurrentQuiz(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizFinished(false);
    setQuizMode(true);
  };

  // Handle answer selection
  const handleAnswerSelect = (answer) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  // Submit answer
  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      Toast.warning('답을 선택해주세요.');
      return;
    }

    const currentQuestion = quizQuestions[currentQuiz];
    const isCorrect = selectedAnswer === currentQuestion.answer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    setShowResult(true);
  };

  // Next question or finish
  const handleNextQuestion = async () => {
    if (currentQuiz < quizQuestions.length - 1) {
      setCurrentQuiz((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Quiz finished
      setQuizFinished(true);

      // Save learning record
      const passed = score >= CONFIG.QUIZ_PASS_THRESHOLD;
      try {
        await supabase.from('learning_records').insert({
          user_id: user.id,
          doc_id: selectedDoc.id,
          score: score,
          total_questions: quizQuestions.length,
          passed: passed,
          completed_at: Date.now(),
        });

        if (passed) {
          Toast.success('축하합니다! 퀴즈를 통과했습니다!');
        } else {
          Toast.warning('아쉽습니다. 다시 도전해보세요.');
        }
      } catch (error) {
        console.error('Failed to save learning record:', error);
      }
    }
  };

  // Back to list
  const handleBackToList = () => {
    setSelectedDoc(null);
    setViewState(VIEW_STATES.MENTEE_LIST);
  };

  // Reset quiz
  const handleRetryQuiz = () => {
    prepareQuiz();
  };

  // Section navigation
  const sections = selectedDoc?.sections || [];
  const totalSections = sections.length;

  const handlePrevSection = () => {
    if (currentSection > 0) {
      setCurrentSection((prev) => prev - 1);
    }
  };

  const handleNextSection = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection((prev) => prev + 1);
    } else {
      setStudyCompleted(true);
    }
  };

  if (!selectedDoc) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">선택된 문서가 없습니다.</p>
        <button
          onClick={handleBackToList}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  // Quiz Mode UI
  if (quizMode) {
    if (quizFinished) {
      const passed = score >= CONFIG.QUIZ_PASS_THRESHOLD;
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
                passed ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <span className="text-4xl">{passed ? '🎉' : '😢'}</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {passed ? '축하합니다!' : '아쉽습니다'}
            </h2>

            <p className="text-gray-600 mb-6">
              {quizQuestions.length}문제 중 {score}문제 정답
              {passed ? ' - 통과!' : ` - ${CONFIG.QUIZ_PASS_THRESHOLD}문제 이상 맞춰야 통과입니다.`}
            </p>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
              <div
                className={`h-3 rounded-full transition-all ${
                  passed ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${(score / quizQuestions.length) * 100}%`,
                }}
              />
            </div>

            <div className="flex gap-4 justify-center">
              {!passed && (
                <button
                  onClick={handleRetryQuiz}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  다시 도전하기
                </button>
              )}
              <button
                onClick={handleBackToList}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      );
    }

    const currentQuestion = quizQuestions[currentQuiz];

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Quiz Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800">{selectedDoc.title}</h2>
            <span className="text-sm text-gray-500">
              {currentQuiz + 1} / {quizQuestions.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${((currentQuiz + 1) / quizQuestions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question */}
          <div className="mb-6">
            <p className="text-gray-800 font-medium text-lg mb-4">{currentQuestion.question}</p>

            <div className="space-y-3">
              {currentQuestion.shuffledOptions.map((option, idx) => {
                let optionClass = 'w-full p-4 border-2 rounded-lg text-left transition ';

                if (showResult) {
                  if (option === currentQuestion.answer) {
                    optionClass += 'border-green-500 bg-green-50';
                  } else if (option === selectedAnswer && option !== currentQuestion.answer) {
                    optionClass += 'border-red-500 bg-red-50';
                  } else {
                    optionClass += 'border-gray-200 opacity-50';
                  }
                } else {
                  optionClass +=
                    selectedAnswer === option
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={showResult}
                    className={optionClass}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result Message */}
          {showResult && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                selectedAnswer === currentQuestion.answer
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {selectedAnswer === currentQuestion.answer ? (
                <p>정답입니다!</p>
              ) : (
                <p>
                  틀렸습니다. 정답은 <strong>{currentQuestion.answer}</strong> 입니다.
                </p>
              )}
              {currentQuestion.explanation && (
                <p className="mt-2 text-sm opacity-80">{currentQuestion.explanation}</p>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={showResult ? handleNextQuestion : handleSubmitAnswer}
            className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition"
          >
            {showResult
              ? currentQuiz < quizQuestions.length - 1
                ? '다음 문제'
                : '결과 보기'
              : '정답 확인'}
          </button>
        </div>
      </div>
    );
  }

  // Study Mode UI
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackToList}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            ← 목록으로
          </button>
          <span className="text-sm text-gray-500">Step {selectedDoc.step || 1}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">{selectedDoc.title}</h1>

        {selectedDoc.estimated_minutes && (
          <p className="text-sm text-gray-500">예상 학습 시간: {selectedDoc.estimated_minutes}분</p>
        )}

        {/* Section Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>
              섹션 {currentSection + 1} / {totalSections}
            </span>
            <span>{Math.round(((currentSection + 1) / totalSections) * 100)}% 완료</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${((currentSection + 1) / totalSections) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Section Content */}
      {sections.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {sections[currentSection]?.title || `섹션 ${currentSection + 1}`}
          </h2>

          <div
            className="prose prose-blue max-w-none"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(sections[currentSection]?.content || ''),
            }}
          />

          {/* Section Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <button
              onClick={handlePrevSection}
              disabled={currentSection === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              ← 이전 섹션
            </button>

            {studyCompleted ? (
              <button
                onClick={prepareQuiz}
                className="px-6 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition"
              >
                퀴즈 시작하기
              </button>
            ) : (
              <button
                onClick={handleNextSection}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                {currentSection < totalSections - 1 ? '다음 섹션 →' : '학습 완료'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          이 문서에는 학습 섹션이 없습니다.
        </div>
      )}

      {/* Quick Quiz Button */}
      {studyCompleted && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-2">학습 완료!</h3>
          <p className="opacity-90 mb-4">이제 퀴즈를 풀어 학습 내용을 확인해보세요.</p>
          <button
            onClick={prepareQuiz}
            className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-100 transition"
          >
            퀴즈 시작하기
          </button>
        </div>
      )}
    </div>
  );
}
