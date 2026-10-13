package com.iryo.backend.auth;

import java.time.Instant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank(message = "Enter your name.")
            @Size(min = 2, max = 60, message = "Name must be 2 to 60 characters.")
            String displayName,

            @NotBlank(message = "Enter your email address.")
            @Size(max = 254, message = "Email address is too long.")
            @Email(message = "Enter a valid email address.")
            String email,

            @NotBlank(message = "Enter a password.")
            @Size(min = 8, max = 72, message = "Password must be 8 to 72 characters.")
            @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "Password needs at least one letter and one number.")
            String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email address.") String email,
            @NotBlank(message = "Enter your password.") String password) {
    }

    public record UserResponse(String userId, String displayName, String email) {
    }

    public record AuthResponse(String accessToken, Instant expiresAt, UserResponse user) {
    }
}
