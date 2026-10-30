package enjoytrip.model.api;

// 게시글 상세 응답 DTO: 상세 조회·등록·수정에서 공통 사용
public record BoardDto(
        String id,
        long sequence,
        String category,
        String title,
        String content,
        String authorId,
        String authorName,
        String createdAt,
        String updatedAt,
        boolean canEdit,
        boolean canDelete
) {
    // 등록과 수정은 동일한 요청 구조를 사용
    public record SaveRequest(
            String category,
            String title,
            String content
    ) {
    }

    // 글 목록에는 본문과 권한 플래그를 제외
    public record Summary(
            String id,
            long sequence,
            String category,
            String title,
            String authorId,
            String authorName,
            String createdAt,
            String updatedAt
    ) {
    }
}
