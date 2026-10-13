package com.iryo.backend.auth;

import java.util.UUID;

/** The verified identity attached to a request. Always taken from the token, never from the request body. */
public record AuthUser(UUID id) {
}
