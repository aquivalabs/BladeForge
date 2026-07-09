# scripts/optimize_result.test.py
import hashlib, importlib.util, unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "optd", str(Path(__file__).with_name("optimize_description.py")))
# NB: importing runs module-level skill-creator path setup; that is acceptable
# here because we only call the pure builder, never main().
optd = importlib.util.module_from_spec(spec); spec.loader.exec_module(optd)

OUT = {"best_score": "5/6", "best_train_score": "6/8", "exit_reason": "converged",
       "best_description": "measured desc", "original_description": "old desc"}

class T(unittest.TestCase):
    def test_payload_fields_and_hashes(self):
        qbytes = b'[{"query":"a","should_trigger":true}]'
        p = optd.build_result_payload("ockham", "opus", 5, 0.4, OUT, qbytes, applied=True)
        self.assertEqual(p["skill"], "ockham")
        self.assertEqual(p["best_score"], "5/6")
        self.assertEqual(p["applied"], True)
        self.assertEqual(p["queryset_hash"], hashlib.sha256(qbytes).hexdigest())
        self.assertEqual(p["description_hash"],
                         hashlib.sha256(b"measured desc").hexdigest())
        self.assertIn("measured_at", p)

if __name__ == "__main__":
    unittest.main()
