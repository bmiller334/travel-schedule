# Sales Route Itinerary Planner

## Overview

This is a web-based application designed to help a salesman visualize and manage their daily routes and display that information to their team. The core of the application is an interactive calendar that provides a clear and intuitive schedule for the team. This tool is intended to be a simple and focused solution for route planning and customer management.

## Core Features

### Interactive Calendar

The main feature of this application is the calendar view. It displays the schedule for each day, including all planned customer visits and stops. The information on the calendar is dynamic and updates based on the starting location and the calculated travel times between stops.

### Customer Management

The application allows for basic customer management. One of the key features is the ability to assign a "Rating" to each customer. This rating is an internal metric to gauge the customer's attitude and relationship with the sales team. 

*Note: The current rating system is under review and is expected to be updated to a more effective system.*

### Dynamic Route Information and ETAs

The calendar displays dynamic information about the sales route. It calculates the distance and travel time between each stop, providing a realistic view of the day's schedule. 

A planned feature is the ability to set a default "start time" for each day. This will allow the application to calculate and display an estimated time of arrival (ETA) for each stop on the calendar, providing a more detailed and accurate itinerary.

### Route Optimization

The application includes a "Route Optimizer" to help plan the most efficient route when there are multiple stops in a single day. This feature uses the Google Maps Platform's Directions API to calculate the best route, taking into account the starting location and all the planned stops. This helps to save time and reduce travel-related expenses.

## Future Development & Known Issues

### Customer Rating System

As mentioned, the current customer rating system is a placeholder and will be replaced with a more robust and descriptive system in the future.

### Search Functionality

The search feature, which is used to find and add customers or new locations to the route, is currently experiencing issues. The current implementation uses the Google Maps Places API for autocomplete suggestions, but it is not functioning as expected. This is a priority for future development.

### Default Start Time

The implementation of a default "start time" for each day is a planned enhancement. This will improve the accuracy of the ETA calculations and provide a more detailed schedule on the calendar.
