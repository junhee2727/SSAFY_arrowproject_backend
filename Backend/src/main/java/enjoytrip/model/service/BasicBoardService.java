package enjoytrip.model.service;

import enjoytrip.model.api.BoardDto;
import enjoytrip.model.api.CommonDto.Page;
import enjoytrip.model.dao.*;
import enjoytrip.model.dto.Board;
import enjoytrip.model.dto.Member;
import java.math.BigInteger;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

public final class BasicBoardService implements BoardService {
    private static final BasicBoardService INSTANCE = new BasicBoardService();
    private static final int PAGE_SIZE = 7;
    private static final Set<String> CATEGORIES = Set.of("review", "question", "info", "food", "companion", "free");
    private final BoardDao dao = InMemoryBoardDao.getInstance();
    private final MemberDao members = InMemoryMemberDao.getInstance();
    private BasicBoardService() {}
    public static BasicBoardService getService() { return INSTANCE; }

    public Page<BoardDto.Summary> search(String rawPage, String type, String keyword) {
        String word = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        synchronized (MemoryLock.MONITOR) {
            var selected = dao.findAll().stream().filter(board -> {
                String field = switch (type == null ? "all" : type) {
                    case "title" -> board.getTitle();
                    case "author" -> members.findById(board.getAuthorId()).getName();
                    default -> board.getTitle() + " " + board.getContent();
                };
                return field.toLowerCase(Locale.ROOT).contains(word);
            }).sorted(Comparator.comparing(Board::getCreatedAt).thenComparingLong(Board::getSequence).reversed()).toList();
            int totalPages = Math.max(1, (selected.size() + PAGE_SIZE - 1) / PAGE_SIZE);
            int page = Math.min(parsePage(rawPage), totalPages);
            int start = (page - 1) * PAGE_SIZE;
            var items = selected.subList(start, Math.min(start + PAGE_SIZE, selected.size())).stream().map(this::summary).toList();
            return new Page<>(items, page, PAGE_SIZE, selected.size(), totalPages);
        }
    }
    private int parsePage(String value) {
        if (value == null || !value.matches("[0-9]+")) return 1;
        BigInteger number = new BigInteger(value);
        if (number.signum() <= 0) return 1;
        return number.min(BigInteger.valueOf(Integer.MAX_VALUE)).intValue();
    }
    public BoardDto detail(String id, String viewerId) {
        synchronized (MemoryLock.MONITOR) { return detailDto(requireBoard(id), viewerId); }
    }
    public BoardDto create(String memberId, BoardDto.SaveRequest request) {
        synchronized (MemoryLock.MONITOR) {
            requireMember(memberId);
            var values = validate(request);
            Board board = new Board(UUID.randomUUID().toString(), dao.nextSequence(), memberId,
                    values.category(), values.title(), values.content(), Instant.now(), null);
            dao.insert(board);
            return detailDto(board, memberId);
        }
    }
    public BoardDto update(String id, String memberId, BoardDto.SaveRequest request) {
        synchronized (MemoryLock.MONITOR) {
            Board board = requireOwner(id, memberId);
            var values = validate(request);
            Board updated = board.withContent(values.category(), values.title(), values.content(), Instant.now());
            dao.update(updated);
            return detailDto(updated, memberId);
        }
    }
    public void delete(String id, String memberId) {
        synchronized (MemoryLock.MONITOR) {
            requireOwner(id, memberId);
            dao.delete(id);
        }
    }
    private BoardDto.SaveRequest validate(BoardDto.SaveRequest request) {
        if (request == null) throw ApiException.validation("게시글을 입력해주세요.");
        if (request.category() == null || !CATEGORIES.contains(request.category())) throw ApiException.validation("올바른 분류를 선택해주세요.");
        return new BoardDto.SaveRequest(request.category(), Validation.text(request.title(), 1, 80, "제목"),
                Validation.text(request.content(), 1, 2000, "내용"));
    }
    private Member requireMember(String id) {
        if (id == null) throw ApiException.loginRequired();
        Member member = members.findById(id);
        if (member == null) throw ApiException.loginRequired();
        return member;
    }
    private Board requireBoard(String id) {
        Board board = id == null ? null : dao.findById(id);
        if (board == null) throw new ApiException(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
        return board;
    }
    private Board requireOwner(String id, String memberId) {
        requireMember(memberId);
        Board board = requireBoard(id);
        if (!board.getAuthorId().equals(memberId)) throw new ApiException(403, "NOT_POST_OWNER", "작성자만 변경할 수 있습니다.");
        return board;
    }
    private BoardDto.Summary summary(Board board) {
        return new BoardDto.Summary(board.getId(), board.getSequence(), board.getCategory(), board.getTitle(),
                board.getAuthorId(), members.findById(board.getAuthorId()).getName(), board.getCreatedAt().toString(),
                board.getUpdatedAt() == null ? null : board.getUpdatedAt().toString());
    }
    private BoardDto detailDto(Board board, String viewerId) {
        boolean owner = board.getAuthorId().equals(viewerId);
        return new BoardDto(board.getId(), board.getSequence(), board.getCategory(), board.getTitle(), board.getContent(),
                board.getAuthorId(), members.findById(board.getAuthorId()).getName(), board.getCreatedAt().toString(),
                board.getUpdatedAt() == null ? null : board.getUpdatedAt().toString(), owner, owner);
    }
}
