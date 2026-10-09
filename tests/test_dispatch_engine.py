import unittest
import asyncio
from backend.merge_engine.dispatch_engine import (
    DispatchCoordinator, 
    haversine_distance_km, 
    estimate_road_eta_mins,
    DEFAULT_ANCHOR,
    VERIFIED_HOSPITALS
)

class TestDispatchEngine(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.coordinator = DispatchCoordinator()

    def test_anchor_and_hospitals(self):
        state = self.coordinator.get_state()
        self.assertEqual(state["operating_anchor"]["name"], DEFAULT_ANCHOR["name"])
        self.assertAlmostEqual(state["operating_anchor"]["lat"], DEFAULT_ANCHOR["lat"], places=4)
        self.assertAlmostEqual(state["operating_anchor"]["lng"], DEFAULT_ANCHOR["lng"], places=4)
        
        # Verify real hospitals exist
        hospital_names = [h["name"] for h in state["hospitals"]]
        self.assertIn("TR Hospital, JP Nagar 8th Phase", hospital_names)
        self.assertIn("Rajnandani Hospital, JP Nagar 8th Phase", hospital_names)
        self.assertIn("Metro Hospital, Kanakapura Road", hospital_names)
        self.assertIn("Fortis Hospital, Bannerghatta Road", hospital_names)
        self.assertIn("Aster RV Hospital, JP Nagar 1st Phase", hospital_names)

    def test_initial_multi_offers(self):
        state = self.coordinator.get_state()
        offers = state["active_offers"]
        # Exactly top 3 eligible ambulances offered
        self.assertEqual(len(offers), 3)
        offered_ids = [o["ambulance_id"] for o in offers]
        
        # Verify offline (AMB-11) and stale GPS (AMB-12) are NOT offered
        self.assertNotIn("AMB-11", offered_ids)
        self.assertNotIn("AMB-12", offered_ids)

    async def test_decline_and_accept_workflow(self):
        # 1. Decline first offered ambulance
        state = self.coordinator.get_state()
        first_amb_id = state["active_offers"][0]["ambulance_id"]
        second_amb_id = state["active_offers"][1]["ambulance_id"]

        decline_res = await self.coordinator.respond_to_offer_atomic(
            emergency_id="EMG-JP-101",
            ambulance_id=first_amb_id,
            response_type="DECLINE"
        )
        self.assertTrue(decline_res["success"])
        self.assertEqual(decline_res["status"], "DECLINED")

        # 2. Accept with second ambulance
        accept_res = await self.coordinator.respond_to_offer_atomic(
            emergency_id="EMG-JP-101",
            ambulance_id=second_amb_id,
            response_type="ACCEPT"
        )
        self.assertTrue(accept_res["success"])
        self.assertEqual(accept_res["status"], "ASSIGNED")
        self.assertEqual(accept_res["winning_ambulance_id"], second_amb_id)

        # Emergency is now marked assigned
        final_state = self.coordinator.get_state()
        self.assertEqual(final_state["active_emergency"]["status"], "ASSIGNED")
        self.assertEqual(final_state["active_emergency"]["assigned_ambulance_id"], second_amb_id)

    async def test_concurrent_acceptance_race_condition_atomicity(self):
        """
        Critical Test: Two ambulance crews attempt to accept simultaneously.
        Authoritative backend lock must ensure exactly one wins, and the second
        gets an explicit ALREADY_ASSIGNED rejection.
        """
        state = self.coordinator.get_state()
        amb_a = state["active_offers"][0]["ambulance_id"]
        amb_b = state["active_offers"][1]["ambulance_id"]

        # Run concurrent acceptances
        results = await asyncio.gather(
            self.coordinator.respond_to_offer_atomic("EMG-JP-101", amb_a, "ACCEPT"),
            self.coordinator.respond_to_offer_atomic("EMG-JP-101", amb_b, "ACCEPT")
        )

        successes = [r for r in results if r.get("success") is True]
        rejections = [r for r in results if r.get("success") is False]

        self.assertEqual(len(successes), 1, "Exactly one ambulance must win the atomic assignment")
        self.assertEqual(len(rejections), 1, "The second concurrent accept must be rejected")
        self.assertEqual(rejections[0]["reason"], "ALREADY_ASSIGNED")
        self.assertEqual(rejections[0]["winning_ambulance_id"], successes[0]["winning_ambulance_id"])

    async def test_timeout_and_escalation(self):
        initial_group = [o["ambulance_id"] for o in self.coordinator.get_state()["active_offers"]]
        
        # Trigger timeout
        state_after_timeout = self.coordinator.force_offer_timeout()
        next_group = [o["ambulance_id"] for o in state_after_timeout["active_offers"]]
        
        # Next group should be formed with new eligible candidates
        self.assertNotEqual(initial_group, next_group)
        self.assertTrue(len(next_group) > 0)

    def test_haversine_and_eta(self):
        # Distance between RIA ITM and Aster RV Hospital (~150-250m)
        dist = haversine_distance_km(12.910385, 77.585520, 12.911417, 77.585027)
        self.assertLess(dist, 0.5)
        eta = estimate_road_eta_mins(dist)
        self.assertEqual(eta, 1)

if __name__ == "__main__":
    unittest.main()
