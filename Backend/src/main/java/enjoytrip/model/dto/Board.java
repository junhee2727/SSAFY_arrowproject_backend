package enjoytrip.model.dto;

import java.time.Instant;
import java.util.Objects;

// 메모리 DAO에 저장하는 자유게시판 게시글 엔티티
public final class Board {

    private final String id;
    private final long sequence;
    private final String authorId;
    private final String category;
    private final String title;
    private final String content;
    private final Instant createdAt;
    private final Instant updatedAt;

    public Board(String id, long sequence, String authorId,
                 String category, String title, String content,
                 Instant createdAt, Instant updatedAt) {
        this.id = Objects.requireNonNull(id);
        this.sequence = sequence;
        this.authorId = Objects.requireNonNull(authorId);
        this.category = Objects.requireNonNull(category);
        this.title = Objects.requireNonNull(title);
        this.content = Objects.requireNonNull(content);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = updatedAt; // 미수정이면 null
    }

    // 번호·작성자·생성일은 유지하고 수정된 새 객체를 반환한다.
    public Board withContent(String category, String title,
                             String content, Instant modifiedAt) {
        return new Board(
                id, sequence, authorId, category, title, content,
                createdAt, Objects.requireNonNull(modifiedAt)
        );
    }

    public String getId() {
        return id;
    }

    public long getSequence() {
        return sequence;
    }

    public String getAuthorId() {
        return authorId;
    }

    public String getCategory() {
        return category;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
