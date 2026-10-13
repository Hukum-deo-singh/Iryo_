package com.iryo.backend.common;

/** Every error response has this shape. */
public record ErrorBody(String code, String message) {
}
