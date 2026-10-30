package enjoytrip.model.dao;

import enjoytrip.model.dto.Board;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public final class InMemoryBoardDao implements BoardDao {
    private static final InMemoryBoardDao INSTANCE = new InMemoryBoardDao();
    private final Map<String, Board> boards = new HashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private InMemoryBoardDao() {}
    public static InMemoryBoardDao getInstance() { return INSTANCE; }
    public Board findById(String id) {
        synchronized (MemoryLock.MONITOR) { return boards.get(id); }
    }
    public List<Board> findAll() {
        synchronized (MemoryLock.MONITOR) { return List.copyOf(boards.values()); }
    }
    public long nextSequence() { return sequence.incrementAndGet(); }
    public void insert(Board board) {
        synchronized (MemoryLock.MONITOR) { boards.put(board.getId(), board); }
    }
    public void update(Board board) {
        synchronized (MemoryLock.MONITOR) { boards.replace(board.getId(), board); }
    }
    public void delete(String id) {
        synchronized (MemoryLock.MONITOR) { boards.remove(id); }
    }
    public void deleteByAuthorId(String authorId) {
        synchronized (MemoryLock.MONITOR) { boards.values().removeIf(b -> b.getAuthorId().equals(authorId)); }
    }
}
