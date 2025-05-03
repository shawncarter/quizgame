# Player Registration and Profile Management

This document provides an overview of the player registration and profile management system in the QuizGame application.

## Overview

The player management system allows users to create and manage their player profiles, view their game statistics, and interact with other players in the lobby. The system uses a combination of server-side storage (MongoDB) and client-side storage (localStorage) to maintain player sessions across page refreshes and browser restarts.

## Features

### Player Registration

1. **Registration Form**: Players can register with their name, age, and specialist subject.
2. **Avatar Selection**: Players can choose from a selection of avatars (placeholders in the current implementation).
3. **Buzzer Sound Selection**: Players can choose from a selection of buzzer sounds (placeholders in the current implementation).
4. **Device Recognition**: The system generates a unique device ID to recognize returning players.
5. **Form Validation**: All required fields are validated before submission.

### Profile Management

1. **Profile Viewing**: Players can view their profile information and game statistics.
2. **Profile Editing**: Players can update their profile information, avatar, and buzzer sound.
3. **Account Deletion**: Players can delete their account if desired.
4. **Automatic Login**: Players are automatically logged in based on their device ID.

### Player Lobby

1. **Player List**: A list of all registered players with their basic information.
2. **Current Player Highlighting**: The current player is highlighted in the list.
3. **Profile Navigation**: Players can navigate to view other players' profiles.
4. **Game Invitation**: (Placeholder) Players can invite others to their games.

## Technical Implementation

### Server-Side

- **Player Model**: Stores player information, game history, and statistics.
- **API Endpoints**: RESTful endpoints for player CRUD operations.
- **Device Recognition**: Players can be identified by their device ID.
- **Statistics Calculation**: Methods for calculating player statistics based on game history.

### Client-Side

- **Player Context**: React context for managing player state throughout the application.
- **Local Storage**: Persists player information between sessions.
- **API Services**: Services for communicating with the server-side API.
- **Form Validation**: Client-side validation for player inputs.

## User Flow

1. **New Player**:
   - User visits the application for the first time
   - User clicks "Register Now" on the home page
   - User fills out the registration form
   - User is redirected to the home page as a logged-in player

2. **Returning Player**:
   - User visits the application
   - System automatically recognizes the user's device
   - User is logged in automatically
   - User can view and edit their profile

3. **Profile Management**:
   - User navigates to their profile page
   - User can view their game statistics
   - User can edit their profile information
   - User can delete their account if desired

4. **Player Interaction**:
   - User navigates to the player lobby
   - User can view all registered players
   - User can view other players' profiles
   - User can (eventually) invite other players to games

## Best Practices

1. **Data Privacy**: Only collect necessary player information.
2. **Form Validation**: Validate all inputs on both client and server sides.
3. **Error Handling**: Provide clear error messages for failed operations.
4. **User Experience**: Make the registration and profile management process as smooth as possible.
5. **Responsive Design**: Ensure the interface works well on all device sizes.

## Future Enhancements

1. **Real Avatar Images**: Replace placeholder avatars with actual images or customizable avatars.
2. **Actual Buzzer Sounds**: Implement real sound files for buzzer options.
3. **Social Features**: Add friend lists, direct messaging, and more social interactions.
4. **Advanced Statistics**: More detailed game performance statistics and visualizations.
5. **Profile Badges**: Achievement badges for reaching certain milestones.
6. **Email Integration**: Allow players to associate their profiles with email addresses for recovery.

## Troubleshooting

- **Login Issues**: If automatic login fails, try registering again with the same information.
- **Profile Updates**: If profile updates don't appear immediately, try refreshing the page.
- **Data Persistence**: If player data is lost, check browser localStorage settings and ensure cookies are enabled.
