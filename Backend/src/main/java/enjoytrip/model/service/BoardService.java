package enjoytrip.model.service;

import enjoytrip.model.api.BoardDto;
import enjoytrip.model.api.CommonDto.Page;

public interface BoardService {
    Page<BoardDto.Summary> search(String page, String type, String keyword);
    BoardDto detail(String id, String viewerId);
    BoardDto create(String memberId, BoardDto.SaveRequest request);
    BoardDto update(String id, String memberId, BoardDto.SaveRequest request);
    void delete(String id, String memberId);
}
