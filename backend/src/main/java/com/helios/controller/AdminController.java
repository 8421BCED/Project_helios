package com.helios.controller;

import com.helios.model.User;
import com.helios.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;

    public AdminController(UserService userService) {
        this.userService = userService;
    }

    private boolean isNotAuthorized(String headerPassword, String queryPassword) {
        if (headerPassword != null && headerPassword.equals("sweet")) {
            return false;
        }
        if (queryPassword != null && queryPassword.equals("sweet")) {
            return false;
        }
        return true;
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(
            @RequestHeader(value = "X-Admin-Password", required = false) String adminPassword,
            @RequestParam(value = "password", required = false) String queryPassword
    ) {
        if (isNotAuthorized(adminPassword, queryPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Invalid admin password"));
        }
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(
            @RequestHeader(value = "X-Admin-Password", required = false) String adminPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @RequestBody User user
    ) {
        if (isNotAuthorized(adminPassword, queryPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Invalid admin password"));
        }
        try {
            User created = userService.createUser(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(
            @RequestHeader(value = "X-Admin-Password", required = false) String adminPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @PathVariable Long id,
            @RequestBody User userDetails
    ) {
        if (isNotAuthorized(adminPassword, queryPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Invalid admin password"));
        }
        try {
            User updated = userService.updateUser(id, userDetails);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(
            @RequestHeader(value = "X-Admin-Password", required = false) String adminPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @PathVariable Long id
    ) {
        if (isNotAuthorized(adminPassword, queryPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Invalid admin password"));
        }
        try {
            userService.deleteUser(id);
            return ResponseEntity.ok(Map.of("status", "success", "message", "User deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
