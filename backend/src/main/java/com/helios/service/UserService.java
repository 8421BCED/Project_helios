package com.helios.service;

import com.helios.model.User;
import com.helios.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User register(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }
        user.setLastActive(System.currentTimeMillis());
        user.setTotalTimeSpentSeconds(0L);
        user.setStationsClicks(0L);
        user.setWeatherClicks(0L);
        user.setStarlinkClicks(0L);
        user.setGpsClicks(0L);
        return userRepository.save(user);
    }

    public User login(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));
        if (!user.getPassword().equals(password)) {
            throw new IllegalArgumentException("Invalid username or password");
        }
        user.setLastActive(System.currentTimeMillis());
        return userRepository.save(user);
    }

    public User ping(String username, long deltaSeconds) {
        Optional<User> opt = userRepository.findByUsername(username);
        if (opt.isPresent()) {
            User user = opt.get();
            user.setLastActive(System.currentTimeMillis());
            user.setTotalTimeSpentSeconds(user.getTotalTimeSpentSeconds() + deltaSeconds);
            return userRepository.save(user);
        }
        return null;
    }

    public User recordClick(String username, String category) {
        Optional<User> opt = userRepository.findByUsername(username);
        if (opt.isPresent()) {
            User user = opt.get();
            if ("stations".equalsIgnoreCase(category)) {
                user.setStationsClicks(user.getStationsClicks() + 1);
            } else if ("weather".equalsIgnoreCase(category)) {
                user.setWeatherClicks(user.getWeatherClicks() + 1);
            } else if ("starlink".equalsIgnoreCase(category)) {
                user.setStarlinkClicks(user.getStarlinkClicks() + 1);
            } else if ("gps".equalsIgnoreCase(category)) {
                user.setGpsClicks(user.getGpsClicks() + 1);
            }
            return userRepository.save(user);
        }
        return null;
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public User createUser(User user) {
        return register(user);
    }

    public User updateUser(Long id, User userDetails) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        // Only update fields if they are provided and unique
        if (userDetails.getUsername() != null && !userDetails.getUsername().isBlank()) {
            Optional<User> existing = userRepository.findByUsername(userDetails.getUsername());
            if (existing.isPresent() && !existing.get().getId().equals(id)) {
                throw new IllegalArgumentException("Username already exists");
            }
            user.setUsername(userDetails.getUsername());
        }

        if (userDetails.getEmail() != null && !userDetails.getEmail().isBlank()) {
            Optional<User> existing = userRepository.findByEmail(userDetails.getEmail());
            if (existing.isPresent() && !existing.get().getId().equals(id)) {
                throw new IllegalArgumentException("Email already exists");
            }
            user.setEmail(userDetails.getEmail());
        }

        if (userDetails.getPassword() != null && !userDetails.getPassword().isBlank()) {
            user.setPassword(userDetails.getPassword());
        }

        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }
}
