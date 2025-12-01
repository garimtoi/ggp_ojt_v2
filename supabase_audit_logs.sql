-- OJT Master - Audit Logs Schema
-- 역할 변경 및 보안 이벤트 감사 로그
-- Supabase SQL Editor에서 실행하세요

-- 1. audit_logs 테이블 생성
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ROLE_CHANGE',      -- 역할 변경
    'LOGIN',            -- 로그인
    'LOGOUT',           -- 로그아웃
    'DOC_CREATE',       -- 문서 생성
    'DOC_UPDATE',       -- 문서 수정
    'DOC_DELETE',       -- 문서 삭제
    'SECURITY_ALERT'    -- 보안 경고
  )),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

-- 3. RLS 활성화
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 관리자만 조회 가능
CREATE POLICY "Only admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (public.is_admin());

-- 5. RLS 정책: 시스템만 삽입 가능 (트리거 통해)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- 6. 역할 변경 감사 트리거 함수
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 역할이 변경된 경우에만 로그 기록
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (
      event_type,
      table_name,
      record_id,
      old_value,
      new_value,
      performed_by,
      metadata
    ) VALUES (
      'ROLE_CHANGE',
      'users',
      NEW.id,
      jsonb_build_object('role', OLD.role, 'name', OLD.name),
      jsonb_build_object('role', NEW.role, 'name', NEW.name),
      auth.uid(),
      jsonb_build_object(
        'changed_user_id', NEW.id,
        'changed_user_name', NEW.name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. users 테이블에 트리거 연결
DROP TRIGGER IF EXISTS audit_user_role_change ON users;
CREATE TRIGGER audit_user_role_change
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_role_change();

-- 8. 문서 삭제 감사 트리거 함수
CREATE OR REPLACE FUNCTION log_doc_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    event_type,
    table_name,
    record_id,
    old_value,
    performed_by,
    metadata
  ) VALUES (
    'DOC_DELETE',
    'ojt_docs',
    OLD.id,
    jsonb_build_object(
      'title', OLD.title,
      'team', OLD.team,
      'author_id', OLD.author_id,
      'author_name', OLD.author_name
    ),
    auth.uid(),
    jsonb_build_object('deleted_at', NOW())
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ojt_docs 테이블에 삭제 트리거 연결
DROP TRIGGER IF EXISTS audit_doc_delete ON ojt_docs;
CREATE TRIGGER audit_doc_delete
  BEFORE DELETE ON ojt_docs
  FOR EACH ROW
  EXECUTE FUNCTION log_doc_delete();

-- 10. 감사 로그 조회 함수 (관리자용)
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_event_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  table_name TEXT,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performer_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- 관리자만 조회 가능
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.event_type,
    al.table_name,
    al.record_id,
    al.old_value,
    al.new_value,
    al.performed_by,
    u.name as performer_name,
    al.created_at
  FROM audit_logs al
  LEFT JOIN users u ON al.performed_by = u.id
  WHERE (p_event_type IS NULL OR al.event_type = p_event_type)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 역할 변경 이력 조회 함수
CREATE OR REPLACE FUNCTION get_role_change_history(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  changed_at TIMESTAMPTZ,
  user_id UUID,
  user_name TEXT,
  old_role TEXT,
  new_role TEXT,
  changed_by UUID,
  changed_by_name TEXT
) AS $$
BEGIN
  -- 관리자만 조회 가능
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT
    al.created_at as changed_at,
    al.record_id as user_id,
    (al.new_value->>'name')::TEXT as user_name,
    (al.old_value->>'role')::TEXT as old_role,
    (al.new_value->>'role')::TEXT as new_role,
    al.performed_by as changed_by,
    u.name as changed_by_name
  FROM audit_logs al
  LEFT JOIN users u ON al.performed_by = u.id
  WHERE al.event_type = 'ROLE_CHANGE'
    AND (p_user_id IS NULL OR al.record_id = p_user_id)
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE 'Audit logs schema created successfully!';
  RAISE NOTICE 'Tables: audit_logs';
  RAISE NOTICE 'Triggers: audit_user_role_change, audit_doc_delete';
  RAISE NOTICE 'Functions: get_audit_logs(), get_role_change_history()';
END $$;
