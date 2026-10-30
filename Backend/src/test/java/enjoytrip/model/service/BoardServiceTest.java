package enjoytrip.model.service;

import enjoytrip.model.api.BoardDto;
import enjoytrip.model.api.MemberDto;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class BoardServiceTest {
    private final MemberService members = BasicMemberService.getService();
    private final BoardService boards = BasicBoardService.getService();
    private MemberDto member() {
        return members.register(new MemberDto.SignupRequest("여행자", UUID.randomUUID()+"@example.com", "password123", "password123", true));
    }
    private BoardDto.SaveRequest post(String title) { return new BoardDto.SaveRequest("review", title, "한글 본문"); }
    @Test void searchAndPaginationShareFilterAndClampPage() {
        var owner = member();
        String keyword = UUID.randomUUID().toString();
        for (int i=0; i<8; i++) boards.create(owner.id(), post(keyword+"-"+i));
        var first = boards.search("1", "title", keyword);
        var last = boards.search("999999999999999999999999999", "title", keyword);
        assertEquals(8, first.totalItems()); assertEquals(7, first.items().size());
        assertEquals(2, last.page()); assertEquals(1, last.items().size());
        assertEquals(1, boards.search("-1", "title", keyword).page());
        var empty = boards.search("1", "all", UUID.randomUUID().toString());
        assertEquals(0, empty.totalItems()); assertEquals(1, empty.totalPages());
        members.delete(owner.id());
    }
    @Test void ownershipRenameAndCascadingDeleteRemainConsistent() {
        var owner=member(); var other=member();
        var post=boards.create(owner.id(), post("여행 후기"));
        assertTrue(post.canEdit()); assertFalse(boards.detail(post.id(), other.id()).canDelete());
        assertEquals(403, assertThrows(ApiException.class, () -> boards.update(post.id(),other.id(),post("변경"))).status());
        assertEquals(403, assertThrows(ApiException.class, () -> boards.delete(post.id(),other.id())).status());
        assertEquals(401, assertThrows(ApiException.class, () -> boards.create(null,post("비회원"))).status());
        members.rename(owner.id(),new MemberDto.UpdateRequest("변경이름"));
        assertEquals("변경이름",boards.detail(post.id(),null).authorName());
        assertTrue(boards.search("1","author","변경이름").items().stream().anyMatch(p -> p.id().equals(post.id())));
        var updated=boards.update(post.id(),owner.id(),post("수정 후기"));
        assertEquals(post.createdAt(),updated.createdAt()); assertNotNull(updated.updatedAt());
        var otherPost=boards.create(other.id(),post("타인 글"));
        members.delete(owner.id());
        assertEquals(404,assertThrows(ApiException.class,()->boards.detail(post.id(),null)).status());
        assertEquals(otherPost.id(),boards.detail(otherPost.id(),other.id()).id());
        members.delete(other.id());
    }
    @Test void validatesWhitespaceLengthsAndCategory() {
        var owner=member();
        for(var invalid : new BoardDto.SaveRequest[]{post(" "),post("a".repeat(81)),new BoardDto.SaveRequest("invalid","제목","본문"),new BoardDto.SaveRequest("free","제목"," "),new BoardDto.SaveRequest("free","제목","a".repeat(2001))}) {
            assertEquals(400,assertThrows(ApiException.class,()->boards.create(owner.id(),invalid)).status());
        }
        assertNotNull(boards.create(owner.id(),new BoardDto.SaveRequest("free","a".repeat(80),"b".repeat(2000))));
        members.delete(owner.id());
    }
    @Test void concurrentCreatesUseUniqueNumbersAndDeletionDoesNotReuseNumbers() throws Exception {
        var owner=member();
        try(var executor=Executors.newFixedThreadPool(4)) {
            var results=executor.invokeAll(IntStream.range(0,12).<java.util.concurrent.Callable<BoardDto>>mapToObj(i->()->boards.create(owner.id(),post("동시 글"))).toList());
            var posts=new java.util.ArrayList<BoardDto>(); for(var result:results) posts.add(result.get());
            assertEquals(12, posts.stream().map(BoardDto::sequence).distinct().count());
            long max=posts.stream().mapToLong(BoardDto::sequence).max().orElseThrow();
            for(var p:posts) boards.delete(p.id(),owner.id());
            assertTrue(boards.create(owner.id(),post("다음 번호")).sequence()>max);
        }
        members.delete(owner.id());
    }
}
