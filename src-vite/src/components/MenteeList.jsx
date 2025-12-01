// OJT Master v2.3.0 - Mentee List Component

import { useState, useMemo } from 'react';
import { useDocs } from '../contexts/DocsContext';
import { useAuth } from '../contexts/AuthContext';
import { VIEW_STATES } from '../constants';

export default function MenteeList() {
  const { allDocs, availableTeams, setSelectedDoc, isLoading } = useDocs();
  const { setViewState } = useAuth();

  const [selectedTeam, setSelectedTeam] = useState(null);

  // Filter docs by selected team
  const teamDocs = useMemo(() => {
    if (!selectedTeam) return allDocs;
    return allDocs.filter((d) => d.team === selectedTeam);
  }, [allDocs, selectedTeam]);

  // Group docs by step
  const docsByStep = useMemo(() => {
    return teamDocs.reduce((acc, doc) => {
      const step = doc.step || 1;
      if (!acc[step]) acc[step] = [];
      acc[step].push(doc);
      return acc;
    }, {});
  }, [teamDocs]);

  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setViewState(VIEW_STATES.MENTEE_STUDY);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">팀 선택</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedTeam === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {availableTeams.map((team) => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedTeam === team
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {team}
            </button>
          ))}
        </div>
      </div>

      {/* Learning Roadmap */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          학습 로드맵
          {selectedTeam && <span className="text-blue-500 ml-2">- {selectedTeam}</span>}
        </h2>

        {Object.keys(docsByStep).length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {selectedTeam
              ? `${selectedTeam} 팀의 학습 자료가 없습니다.`
              : '아직 학습 자료가 없습니다.'}
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(docsByStep)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([step, docs]) => (
                <div key={step}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Step {step}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {docs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleDocSelect(doc)}
                        className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition">
                            <span className="text-blue-600 font-bold">{step}</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-gray-800 truncate group-hover:text-blue-600">
                              {doc.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {doc.sections?.length || 0}개 섹션 · {doc.quiz?.length || 0}개 퀴즈
                            </p>
                            {doc.estimated_minutes && (
                              <p className="text-xs text-gray-400">약 {doc.estimated_minutes}분</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
