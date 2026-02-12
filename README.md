# Gemini API Test

A simple FastAPI application for testing Gemini API integration.

## Features

- FastAPI web framework
- Simple status endpoint

## Installation

```bash
pip install fastapi uvicorn
```

## Usage

Run the application:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## Endpoints

- `GET /` - Returns status message
