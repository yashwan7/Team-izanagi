import unittest
from fastapi.testclient import TestClient
from backend.merge_engine.service import app

class TestDispatchEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_get_dispatch_state(self):
        response = self.client.get("/api/dispatch/state")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["demo_mode"])
        self.assertEqual(data["operating_anchor"]["name"], "80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru")
        self.assertEqual(len(data["hospitals"]), 8)
        self.assertEqual(len(data["ambulances"]), 12)
        self.assertEqual(len(data["active_offers"]), 3)

    def test_respond_offer_accept(self):
        # Reset first
        self.client.post("/api/dispatch/reset-demo")
        state = self.client.get("/api/dispatch/state").json()
        first_amb = state["active_offers"][0]["ambulance_id"]

        res = self.client.post("/api/dispatch/respond-offer", json={
            "emergency_id": "EMG-JP-101",
            "ambulance_id": first_amb,
            "response": "ACCEPT"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["winning_ambulance_id"], first_amb)

        # Subsequent accept from another ambulance must be rejected with ALREADY_ASSIGNED
        second_amb = state["active_offers"][1]["ambulance_id"]
        res2 = self.client.post("/api/dispatch/respond-offer", json={
            "emergency_id": "EMG-JP-101",
            "ambulance_id": second_amb,
            "response": "ACCEPT"
        })
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertFalse(data2["success"])
        self.assertEqual(data2["reason"], "ALREADY_ASSIGNED")
        self.assertEqual(data2["winning_ambulance_id"], first_amb)

    def test_set_radius_and_location(self):
        # Set radius to 10km
        res = self.client.post("/api/dispatch/set-radius", json={"radius_km": 10.0})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["operating_radius_km"], 10.0)

        # Set location to Sarakki Signal
        res_loc = self.client.post("/api/dispatch/set-location", json={
            "lat": 12.912640,
            "lng": 77.579480,
            "label": "Sarakki Signal / 21st Main",
            "patient_id": "PT-101"
        })
        self.assertEqual(res_loc.status_code, 200)
        self.assertAlmostEqual(res_loc.json()["active_emergency"]["lat"], 12.912640, places=4)

if __name__ == "__main__":
    unittest.main()
