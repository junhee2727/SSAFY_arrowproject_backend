package enjoytrip.model.dao;

/** Shared transaction boundary for member/post operations and consistent reads. */
public final class MemoryLock {
    public static final Object MONITOR = new Object();
    private MemoryLock() {}
}
