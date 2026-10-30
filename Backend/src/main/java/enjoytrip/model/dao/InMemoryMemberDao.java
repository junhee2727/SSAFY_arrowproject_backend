package enjoytrip.model.dao;

import enjoytrip.model.dto.Member;
import java.util.HashMap;
import java.util.Map;

public final class InMemoryMemberDao implements MemberDao {
    private static final InMemoryMemberDao INSTANCE = new InMemoryMemberDao();
    private final Map<String, Member> members = new HashMap<>();
    private InMemoryMemberDao() {}
    public static InMemoryMemberDao getInstance() { return INSTANCE; }

    public Member findById(String id) {
        synchronized (MemoryLock.MONITOR) { return members.get(id); }
    }
    public Member findByEmail(String email) {
        synchronized (MemoryLock.MONITOR) {
            return members.values().stream().filter(m -> m.getEmail().equals(email)).findFirst().orElse(null);
        }
    }
    public void insert(Member member) {
        synchronized (MemoryLock.MONITOR) { members.put(member.getId(), member); }
    }
    public void update(Member member) {
        synchronized (MemoryLock.MONITOR) { members.replace(member.getId(), member); }
    }
    public void delete(String id) {
        synchronized (MemoryLock.MONITOR) { members.remove(id); }
    }
}
