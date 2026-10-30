package enjoytrip.model.api;

import java.util.List;

public final class CommonDto {

    private CommonDto() {
    }

    // {"data": ...}
    public record Response<T>(T data) {
    }

    public record Page<T>(
            List<T> items,
            int page,
            int pageSize,
            long totalItems,
            int totalPages
    ) {
        public Page {
            items = List.copyOf(items);
        }
    }

    // {"error": {"code": "...", "message": "..."}}
    public record ErrorResponse(ErrorBody error) {
    }

    public record ErrorBody(String code, String message) {
    }
}
