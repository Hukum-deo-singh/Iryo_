package com.iryo.backend.config;

import java.time.Clock;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.iryo.backend.auth.JwtService;
import com.iryo.backend.measurement.DerivedDataService;

@Configuration
@EnableConfigurationProperties(IryoProperties.class)
@EnableScheduling
public class AppConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public JwtService jwtService(IryoProperties properties, Clock clock) {
        return new JwtService(properties.jwt().secret(), properties.jwt().expiryMinutes(), clock);
    }

    @Bean
    public DerivedDataService derivedDataService(IryoProperties properties) {
        return new DerivedDataService(properties.thresholds());
    }
}
