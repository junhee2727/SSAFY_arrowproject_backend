package enjoytrip.model.service;

import enjoytrip.model.api.MemberDto;

public interface MemberService {
    record Authentication(MemberDto member, long credentialVersion) {}
    MemberDto.RecoveryResponse register(MemberDto.SignupRequest request);
    Authentication login(MemberDto.LoginRequest request);
    MemberDto.RecoveryResponse resetPassword(MemberDto.PasswordResetRequest request);
    MemberDto authenticatedProfile(String id, long credentialVersion);
    MemberDto profile(String id);
    MemberDto rename(String id, MemberDto.UpdateRequest request);
    void delete(String id);
}
