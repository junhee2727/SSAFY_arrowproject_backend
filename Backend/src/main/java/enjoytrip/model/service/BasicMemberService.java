package enjoytrip.model.service;

import enjoytrip.model.api.MemberDto;
import enjoytrip.model.dao.InMemoryMemberDao;
import enjoytrip.model.dao.MemberDao;
import enjoytrip.model.dao.MemoryLock;
import enjoytrip.model.dto.Member;
import java.time.Instant;
import java.util.UUID;

public final class BasicMemberService implements MemberService {
    private static final BasicMemberService INSTANCE = new BasicMemberService();
    private final MemberDao dao = InMemoryMemberDao.getInstance();
    private BasicMemberService() {}
    public static BasicMemberService getService() { return INSTANCE; }

    public MemberDto.RecoveryResponse register(MemberDto.SignupRequest request) {
        if (request == null) throw ApiException.validation("가입 정보를 입력해주세요.");
        String name = Validation.name(request.name());
        String email = Validation.email(request.email());
        validatePassword(request.password(), request.passwordConfirm());
        if (!Boolean.TRUE.equals(request.terms())) throw ApiException.validation("약관에 동의해주세요.");
        PasswordHasher.Encoded encoded = PasswordHasher.encode(request.password());
        String recoveryCode = RecoveryCodes.generate();
        synchronized (MemoryLock.MONITOR) {
            if (dao.findByEmail(email) != null) throw new ApiException(409, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다.");
            Member member = new Member(UUID.randomUUID().toString(), name, email, encoded.hash(), encoded.salt(),
                    Instant.now(), RecoveryCodes.hash(recoveryCode), 0);
            dao.insert(member);
            return recoveryResponse(member, recoveryCode);
        }
    }
    public Authentication login(MemberDto.LoginRequest request) {
        if (request == null) throw ApiException.validation("로그인 정보를 입력해주세요.");
        String email = Validation.email(request.email());
        if (request.password() == null || request.password().isEmpty()) throw ApiException.validation("비밀번호를 입력해주세요.");
        Member member = dao.findByEmail(email);
        if (member == null || !PasswordHasher.matches(request.password(), member.getPasswordHash(), member.getPasswordSalt())) {
            throw new ApiException(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        synchronized (MemoryLock.MONITOR) {
            Member current = dao.findById(member.getId());
            if (current == null || current.getCredentialVersion() != member.getCredentialVersion()) {
                throw new ApiException(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
            }
            return new Authentication(toDto(current), current.getCredentialVersion());
        }
    }

    public MemberDto authenticatedProfile(String id, long credentialVersion) {
        synchronized (MemoryLock.MONITOR) {
            Member member = requireMember(id);
            if (member.getCredentialVersion() != credentialVersion) throw ApiException.loginRequired();
            return toDto(member);
        }
    }

    public MemberDto.RecoveryResponse resetPassword(MemberDto.PasswordResetRequest request) {
        if (request == null) throw ApiException.validation("복구 정보를 입력해주세요.");
        String email = Validation.email(request.email());
        validatePassword(request.password(), request.passwordConfirm());
        String code = request.recoveryCode() == null ? "" : request.recoveryCode().trim();
        Member member = dao.findByEmail(email);
        // 존재하지 않는 이메일도 같은 해시 비교를 수행하고 같은 오류를 반환한다.
        boolean matches = RecoveryCodes.matches(code, member == null ? RecoveryCodes.hash("") : member.getRecoveryCodeHash());
        if (member == null || !matches || !code.matches("[A-Za-z0-9_-]{43}")) invalidRecovery();
        PasswordHasher.Encoded encoded = PasswordHasher.encode(request.password());
        String nextCode = RecoveryCodes.generate();
        synchronized (MemoryLock.MONITOR) {
            Member current = dao.findByEmail(email);
            if (current == null || !RecoveryCodes.matches(code, current.getRecoveryCodeHash())) invalidRecovery();
            Member updated = current.withCredentials(encoded.hash(), encoded.salt(), RecoveryCodes.hash(nextCode));
            dao.update(updated);
            return recoveryResponse(updated, nextCode);
        }
    }

    private void validatePassword(String password, String confirmation) {
        if (password == null || password.length() < 8) throw ApiException.validation("비밀번호는 8자 이상 입력해주세요.");
        if (!password.equals(confirmation)) throw ApiException.validation("비밀번호가 일치하지 않습니다.");
    }
    private void invalidRecovery() {
        throw new ApiException(400, "INVALID_RECOVERY", "이메일 또는 복구코드를 확인해주세요.");
    }
    private MemberDto.RecoveryResponse recoveryResponse(Member member, String code) {
        return new MemberDto.RecoveryResponse(member.getId(), member.getName(), member.getEmail(), member.getCreatedAt().toString(), code);
    }
    public MemberDto profile(String id) {
        synchronized (MemoryLock.MONITOR) { return toDto(requireMember(id)); }
    }
    public MemberDto rename(String id, MemberDto.UpdateRequest request) {
        if (request == null) throw ApiException.validation("이름을 입력해주세요.");
        String name = Validation.name(request.name());
        synchronized (MemoryLock.MONITOR) {
            Member updated = requireMember(id).withName(name);
            dao.update(updated);
            return toDto(updated);
        }
    }
    public void delete(String id) {
        synchronized (MemoryLock.MONITOR) {
            requireMember(id);
            enjoytrip.model.dao.InMemoryBoardDao.getInstance().deleteByAuthorId(id);
            dao.delete(id);
        }
    }
    private Member requireMember(String id) {
        if (id == null) throw ApiException.loginRequired();
        Member member = dao.findById(id);
        if (member == null) throw ApiException.loginRequired();
        return member;
    }
    private MemberDto toDto(Member member) {
        return new MemberDto(member.getId(), member.getName(), member.getEmail(), member.getCreatedAt().toString());
    }
}
