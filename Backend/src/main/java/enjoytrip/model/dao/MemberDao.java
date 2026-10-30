package enjoytrip.model.dao;

import enjoytrip.model.dto.Member;

public interface MemberDao {
    Member findById(String id);
    Member findByEmail(String email);
    void insert(Member member);
    void update(Member member);
    void delete(String id);
}
