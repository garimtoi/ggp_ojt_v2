// OJT Master v2.3.0 - Documents Context

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { dbGetAll, dbSave, dbDelete } from '../utils/db';
import { sanitizeDocData } from '../utils/helpers';
import { useAuth } from './AuthContext';

const DocsContext = createContext(null);

export function DocsProvider({ children }) {
  const { user } = useAuth();

  // Document states
  const [allDocs, setAllDocs] = useState([]);
  const [myDocs, setMyDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected document for viewing/editing
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);

  // Generated document (from AI)
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [generatedDocs, setGeneratedDocs] = useState([]);

  // Available teams (derived from docs)
  const availableTeams = useMemo(() => {
    const teams = [...new Set(allDocs.map((d) => d.team).filter(Boolean))];
    return teams.sort();
  }, [allDocs]);

  // Load all documents
  const loadAllDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await dbGetAll('ojt_docs');
      const sanitizedDocs = docs.map(sanitizeDocData);
      sanitizedDocs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAllDocs(sanitizedDocs);
    } catch (error) {
      console.error('Load all docs error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load user's documents
  const loadMyDocs = useCallback(async () => {
    if (!user?.id) return;

    try {
      const docs = await dbGetAll('ojt_docs', { authorId: user.id });
      const sanitizedDocs = docs.map(sanitizeDocData);
      sanitizedDocs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMyDocs(sanitizedDocs);
    } catch (error) {
      console.error('Load my docs error:', error);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    loadAllDocs();
  }, [loadAllDocs]);

  // Load user's docs when user changes
  useEffect(() => {
    if (user?.id) {
      loadMyDocs();
    }
  }, [user?.id, loadMyDocs]);

  // Save document
  const saveDocument = useCallback(
    async (doc) => {
      if (!user) throw new Error('로그인이 필요합니다.');

      const docData = {
        ...doc,
        id: doc.id || crypto.randomUUID(),
        author_id: doc.author_id || user.id,
        author_name: doc.author_name || user.name,
        created_at: doc.created_at || Date.now(),
        updated_at: Date.now(),
      };

      await dbSave('ojt_docs', docData);

      // Refresh lists
      await loadAllDocs();
      await loadMyDocs();

      return docData;
    },
    [user, loadAllDocs, loadMyDocs]
  );

  // Delete document
  const deleteDocument = useCallback(
    async (docId) => {
      await dbDelete('ojt_docs', docId);

      // Update local state
      setAllDocs((prev) => prev.filter((d) => d.id !== docId));
      setMyDocs((prev) => prev.filter((d) => d.id !== docId));

      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
      }
      if (editingDoc?.id === docId) {
        setEditingDoc(null);
      }
    },
    [selectedDoc?.id, editingDoc?.id]
  );

  // Get documents by team
  const getDocsByTeam = useCallback(
    (team) => {
      if (!team) return allDocs;
      return allDocs.filter((d) => d.team === team);
    },
    [allDocs]
  );

  // Clear generated documents
  const clearGenerated = useCallback(() => {
    setGeneratedDoc(null);
    setGeneratedDocs([]);
  }, []);

  const value = {
    // State
    allDocs,
    myDocs,
    isLoading,
    availableTeams,
    selectedDoc,
    editingDoc,
    generatedDoc,
    generatedDocs,

    // Setters
    setSelectedDoc,
    setEditingDoc,
    setGeneratedDoc,
    setGeneratedDocs,

    // Actions
    loadAllDocs,
    loadMyDocs,
    saveDocument,
    deleteDocument,
    getDocsByTeam,
    clearGenerated,
  };

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

export function useDocs() {
  const context = useContext(DocsContext);
  if (!context) {
    throw new Error('useDocs must be used within a DocsProvider');
  }
  return context;
}
