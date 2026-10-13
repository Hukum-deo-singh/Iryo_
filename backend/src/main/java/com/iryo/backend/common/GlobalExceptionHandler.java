package com.iryo.backend.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String GENERIC_SERVER = "Something went wrong on our side. Please try again in a moment.";

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorBody> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(new ErrorBody(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorBody> handleUnexpected(Exception ex) {
        LOG.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorBody("SERVER_ERROR", GENERIC_SERVER));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .filter(text -> text != null && !text.isBlank())
                .findFirst()
                .orElse("Please check your details and try again.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorBody("VALIDATION_FAILED", message));
    }

    /** Every other Spring MVC error (bad JSON, wrong method, unknown route) also uses ErrorBody. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        int value = statusCode.value();
        if (value >= 500) {
            LOG.error("Request failed", ex);
        }
        String code = value == 404 ? "NOT_FOUND" : value == 405 ? "METHOD_NOT_ALLOWED" : value < 500 ? "BAD_REQUEST" : "SERVER_ERROR";
        String message = value == 404 ? "We couldn't find what you asked for."
                : value < 500 ? "The request couldn't be processed. Check it and try again." : GENERIC_SERVER;
        return ResponseEntity.status(statusCode).headers(headers).body(new ErrorBody(code, message));
    }
}
