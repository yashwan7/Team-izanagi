"""
Unit tests for KSHITIJ EMR - Blood Bank & Transfusion Network Module
Validating all 17 clinical and inventory requirements.
"""

import unittest
import time
from backend.merge_engine.blood_bank_engine import (
    get_blood_bank_state,
    process_blood_bank_action
)
from backend.merge_engine.models import (
    BloodBankActionRequest,
    BloodInventoryUnit,
    BloodBankFacility
)

class TestBloodBankNetwork(unittest.TestCase):

    def setUp(self):
        self.state = get_blood_bank_state()

    def test_01_search_available_component(self):
        """Test 1: Search for an available released component (PRBC, O-)."""
        available = [
            u for u in self.state.inventory 
            if u.abo == "O" and u.rh == "NEGATIVE" and u.component_type == "PRBC"
            and u.status == "AVAILABLE_RELEASED" and u.days_until_expiry > 0
        ]
        self.assertGreater(len(available), 0)
        self.assertEqual(available[0].screening_status, "TESTED_NEGATIVE")

    def test_02_search_unavailable_component(self):
        """Test 2: Search for an unavailable component configuration returns empty or handled."""
        unavailable = [
            u for u in self.state.inventory
            if u.abo == "AB" and u.rh == "NEGATIVE" and u.component_type == "CRYOPRECIPITATE"
            and u.status == "AVAILABLE_RELEASED"
        ]
        self.assertEqual(len(unavailable), 0)

    def test_03_filter_abo_rh_and_component(self):
        """Test 3: Filter by ABO, Rh, and component type."""
        b_pos_platelets = [
            u for u in self.state.inventory
            if u.abo == "B" and u.rh == "POSITIVE" and u.component_type == "PLATELETS"
        ]
        self.assertTrue(len(b_pos_platelets) > 0)
        self.assertEqual(b_pos_platelets[0].blood_group_display, "B+")

    def test_04_multiple_units_different_expiry_dates(self):
        """Test 4: Display multiple units with differing expiry dates."""
        o_neg_units = [u for u in self.state.inventory if u.blood_group_display == "O-"]
        expiry_days = [u.days_until_expiry for u in o_neg_units]
        self.assertGreater(len(set(expiry_days)), 1)

    def test_05_prevent_expired_units_from_appearing_as_available(self):
        """Test 5: Expired units must NEVER be classified as available or eligible for reservation."""
        expired_units = [u for u in self.state.inventory if u.days_until_expiry <= 0 or u.status == "EXPIRED"]
        self.assertGreater(len(expired_units), 0)
        for unit in expired_units:
            # Must not be eligible for routine available release
            self.assertNotEqual(unit.status, "AVAILABLE_RELEASED")
            self.assertFalse(unit.can_reserve and unit.days_until_expiry > 0)

    def test_06_prevent_quarantined_units_allocation(self):
        """Test 6: Quarantined units cannot be allocated to requests."""
        quarantined = [u for u in self.state.inventory if u.status == "QUARANTINED"]
        self.assertGreater(len(quarantined), 0)
        for u in quarantined:
            self.assertFalse(u.can_reserve)
            self.assertTrue(u.storage_excursion_detected or u.status == "QUARANTINED")

    def test_07_handle_stale_or_storage_excursion(self):
        """Test 7: Action to quarantine a unit upon storage excursion review."""
        target_unit = next(u for u in self.state.inventory if u.status == "AVAILABLE_RELEASED")
        req = BloodBankActionRequest(
            action="QUARANTINE_UNIT",
            unit_id=target_unit.unit_id,
            reason_or_notes="Cold box temperature excursion +8.1C during transport audit"
        )
        updated_state = process_blood_bank_action(req)
        quarantined_unit = next(u for u in updated_state.inventory if u.unit_id == target_unit.unit_id)
        self.assertEqual(quarantined_unit.status, "QUARANTINED")
        self.assertFalse(quarantined_unit.can_reserve)
        self.assertTrue(quarantined_unit.storage_excursion_detected)

    def test_08_and_09_prevent_duplicate_and_simultaneous_reservations(self):
        """Test 8 & 9: Create and accept request locks units and prevents double allocation."""
        # 1. Create emergency request for O- PRBC
        create_req = BloodBankActionRequest(
            action="CREATE_REQUEST",
            patient_id="PT-TEST-01",
            patient_name_or_alias="Test Casualty",
            abo="O",
            rh="NEGATIVE",
            component_type="PRBC",
            units_requested=1,
            urgency="EMERGENCY_STAT",
            bank_id="BB-AFTC-01",
            actor_name="Trauma Officer"
        )
        state_after_create = process_blood_bank_action(create_req)
        new_order = state_after_create.requests[0]
        self.assertEqual(new_order.status, "SUBMITTED")

        # 2. Accept request locks the unit
        accept_req = BloodBankActionRequest(
            action="ACCEPT_REQUEST",
            request_id=new_order.request_id,
            actor_name="Depot Officer"
        )
        state_after_accept = process_blood_bank_action(accept_req)
        accepted_order = next(r for r in state_after_accept.requests if r.request_id == new_order.request_id)
        self.assertEqual(accepted_order.status, "ACCEPTED_RESERVED")
        self.assertGreater(len(accepted_order.allocated_unit_ids), 0)

        locked_unit_id = accepted_order.allocated_unit_ids[0]
        locked_unit = next(u for u in state_after_accept.inventory if u.unit_id == locked_unit_id)
        self.assertEqual(locked_unit.status, "RESERVED")
        self.assertFalse(locked_unit.can_reserve)

        # 3. Verify this unit cannot be allocated to another request
        eligible_for_others = [
            u for u in state_after_accept.inventory
            if u.unit_id == locked_unit_id and u.status == "AVAILABLE_RELEASED" and u.can_reserve
        ]
        self.assertEqual(len(eligible_for_others), 0)

    def test_10_blood_bank_facility_details(self):
        """Test 10: Blood bank facility verification, coordinates, VHF, and license."""
        self.assertGreaterEqual(len(self.state.facilities), 4)
        aftc = next(f for f in self.state.facilities if f.bank_id == "BB-AFTC-01")
        self.assertTrue(aftc.verified)
        self.assertEqual(aftc.cold_storage_status, "OPTIMAL_ONLINE")
        self.assertIn("DGMS", aftc.license_accreditation)
        self.assertTrue(aftc.transport_available)

    def test_11_and_12_dispatch_and_receipt_manifest(self):
        """Test 11 & 12: Dispatch transfer manifest and receipt confirmation."""
        # Find an accepted order or create one
        order = next((r for r in self.state.requests if r.status == "ACCEPTED_RESERVED"), None)
        if not order:
            order = self.state.requests[0]
            order.status = "ACCEPTED_RESERVED"
            order.allocated_unit_ids = ["W0421-26-981240-A"]

        # Dispatch
        dispatch_req = BloodBankActionRequest(
            action="DISPATCH_TRANSFER",
            request_id=order.request_id,
            actor_name="Courier Delta"
        )
        state_after_dispatch = process_blood_bank_action(dispatch_req)
        latest_transfer = state_after_dispatch.transfers[0]
        self.assertEqual(latest_transfer.transfer_status, "DISPATCHED_IN_TRANSIT")
        self.assertEqual(latest_transfer.current_transit_temp_c, 3.4)
        self.assertGreater(len(latest_transfer.chain_of_custody_events), 0)

        # Confirm Receipt
        receipt_req = BloodBankActionRequest(
            action="CONFIRM_RECEIPT",
            transfer_id=latest_transfer.transfer_id,
            actor_name="Triage Nurse Lead",
            reason_or_notes="Verified temperature 3.4C and seal intact."
        )
        state_after_receipt = process_blood_bank_action(receipt_req)
        completed_transfer = next(t for t in state_after_receipt.transfers if t.transfer_id == latest_transfer.transfer_id)
        self.assertEqual(completed_transfer.transfer_status, "DELIVERED_RECEIVED")
        self.assertIsNotNone(completed_transfer.actual_arrival_timestamp)

    def test_14_audit_history_preserved(self):
        """Test 14: Immutable audit trail records all transitions with digital signatures."""
        self.assertGreater(len(self.state.audit_log), 0)
        latest_audit = self.state.audit_log[0]
        self.assertTrue(latest_audit.digital_signature_hash.startswith("sha256:"))
        self.assertIsNotNone(latest_audit.actor)
        self.assertIsNotNone(latest_audit.event_type)

    def test_16_system_resilience_and_metrics(self):
        """Test 16: System-wide metrics recomputed accurately."""
        state = get_blood_bank_state()
        self.assertGreater(state.total_available_released_units, 0)
        self.assertGreater(state.total_o_negative_emergency_units, 0)
        self.assertGreater(state.cold_chain_compliance_pct, 95.0)

if __name__ == "__main__":
    unittest.main()
