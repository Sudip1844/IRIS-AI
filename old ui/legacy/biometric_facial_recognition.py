#!/usr/bin/env python3
"""
MJ Biometric Facial Recognition Script
Local facial recognition for system fault detection using OpenCV and face_recognition
"""

import cv2
import face_recognition
import numpy as np
import os
import json
from datetime import datetime
import sys

class MJBiometricRecognition:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_names = []
        self.encodings_file = "mj_face_encodings.json"
        self.load_known_faces()

    def load_known_faces(self):
        """Load known face encodings from file"""
        if os.path.exists(self.encodings_file):
            try:
                with open(self.encodings_file, 'r') as f:
                    data = json.load(f)
                    self.known_face_encodings = [np.array(enc) for enc in data['encodings']]
                    self.known_face_names = data['names']
                print(f"Loaded {len(self.known_face_names)} known faces")
            except Exception as e:
                print(f"Error loading face encodings: {e}")

    def save_known_faces(self):
        """Save known face encodings to file"""
        data = {
            'encodings': [enc.tolist() for enc in self.known_face_encodings],
            'names': self.known_face_names
        }
        with open(self.encodings_file, 'w') as f:
            json.dump(data, f)

    def enroll_face(self, image_path, name):
        """Enroll a new face from image"""
        try:
            image = face_recognition.load_image_file(image_path)
            face_encodings = face_recognition.face_encodings(image)

            if len(face_encodings) == 0:
                return False, "No face detected in image"

            if len(face_encodings) > 1:
                return False, "Multiple faces detected, please use an image with only one face"

            self.known_face_encodings.append(face_encodings[0])
            self.known_face_names.append(name)
            self.save_known_faces()

            return True, f"Successfully enrolled {name}"
        except Exception as e:
            return False, f"Error enrolling face: {str(e)}"

    def recognize_face(self, image_path):
        """Recognize faces in an image"""
        try:
            image = face_recognition.load_image_file(image_path)
            face_locations = face_recognition.face_locations(image)
            face_encodings = face_recognition.face_encodings(image, face_locations)

            results = []
            for face_encoding in face_encodings:
                matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
                name = "Unknown"

                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                best_match_index = np.argmin(face_distances)

                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]

                results.append({
                    'name': name,
                    'confidence': 1 - face_distances[best_match_index] if len(face_distances) > 0 else 0
                })

            return True, results
        except Exception as e:
            return False, f"Error recognizing face: {str(e)}"

    def scan_from_camera(self):
        """Scan face from camera for real-time detection"""
        video_capture = cv2.VideoCapture(0)

        if not video_capture.isOpened():
            return False, "Could not open camera"

        print("Scanning for faces... Press 'q' to quit")

        face_detected = False
        while True:
            ret, frame = video_capture.read()
            if not ret:
                break

            # Convert BGR to RGB
            rgb_frame = frame[:, :, ::-1]

            # Find faces
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

            for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
                name = "Unknown"

                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                best_match_index = np.argmin(face_distances)

                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    face_detected = True

                # Draw rectangle and name
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
                cv2.putText(frame, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            cv2.imshow('MJ Biometric Scan', frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        video_capture.release()
        cv2.destroyAllWindows()

        return face_detected, "Face scan completed"

def main():
    if len(sys.argv) < 2:
        print("Usage: python biometric_facial_recognition.py <command> [args...]")
        print("Commands:")
        print("  enroll <image_path> <name>  - Enroll a new face")
        print("  recognize <image_path>     - Recognize faces in image")
        print("  scan                       - Scan from camera")
        return

    recognizer = MJBiometricRecognition()
    command = sys.argv[1]

    if command == 'enroll' and len(sys.argv) >= 4:
        image_path = sys.argv[2]
        name = sys.argv[3]
        success, message = recognizer.enroll_face(image_path, name)
        print(message)

    elif command == 'recognize' and len(sys.argv) >= 3:
        image_path = sys.argv[2]
        success, results = recognizer.recognize_face(image_path)
        if success:
            for result in results:
                print(f"Recognized: {result['name']} (Confidence: {result['confidence']:.2f})")
        else:
            print(results)

    elif command == 'scan':
        success, message = recognizer.scan_from_camera()
        print(message)

    else:
        print("Invalid command or arguments")

if __name__ == "__main__":
    main()