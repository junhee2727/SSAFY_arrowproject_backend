package enjoytrip.model.dao;

import enjoytrip.model.dto.Board;
import java.util.List;

public interface BoardDao {
    Board findById(String id);
    List<Board> findAll();
    long nextSequence();
    void insert(Board board);
    void update(Board board);
    void delete(String id);
    void deleteByAuthorId(String authorId);
}
