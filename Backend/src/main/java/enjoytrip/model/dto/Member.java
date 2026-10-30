package enjoytrip.model.dto;

import java.time.Instant;
import java.util.Objects;

// 메모리 DAO에 저장하는 회원 엔티티
public final class Member {

    private final String id;
    private final String name;
    private final String email;
    private final String passwordHash;
    private final String passwordSalt;
    private final Instant createdAt;

    public Member(String id, String name, String email,
                  String passwordHash, String passwordSalt,
                  Instant createdAt) {
        this.id = Objects.requireNonNull(id);
        this.name = Objects.requireNonNull(name);
        this.email = Objects.requireNonNull(email);
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.passwordSalt = Objects.requireNonNull(passwordSalt);
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    // 이름을 바꾼 새 객체를 반환한다. DAO에서 기존 객체를 교체한다.
    public Member withName(String name) {
        return new Member(
                id, name, email, passwordHash, passwordSalt, createdAt
        );
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getPasswordSalt() {
        return passwordSalt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
