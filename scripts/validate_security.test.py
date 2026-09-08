# scripts/validate_security.test.py — validate_security checks result.json's security section + hashes material
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = str(Path(__file__).with_name("validate_security.py"))

POINTS = [
    "prompt-injection", "data-exfiltration", "secret-detection", "dangerous-commands",
    "obfuscation", "external-fetches", "credential-access", "privilege-escalation",
]


def run(*args):
    return subprocess.run([sys.executable, SCRIPT, *map(str, args)],
                          capture_output=True, text=True)


def checklist(verdicts=None):
    verdicts = verdicts or ["pass"] * 8
    return [{"n": i + 1, "point": POINTS[i], "verdict": verdicts[i], "note": "ok"}
            for i in range(8)]


def write_result(security):
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump({"trigger": {}, "acceptance": None, "security": security}, f); f.close()
    return Path(f.name)


def valid_security(verdict="pass", verdicts=None):
    return {
        "verdict": verdict,
        "scanned_at": "2026-09-08T00:00:00",
        "scanned_by": "cerberus:security-scan",
        "scanned_hash": "a" * 64,
        "checklist": checklist(verdicts),
    }


class Validate(unittest.TestCase):
    def test_valid_pass_exit0(self):
        r = run(write_result(valid_security()))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("security: pass", r.stdout)

    def test_valid_flag_when_a_point_flags(self):
        v = ["pass"] * 8; v[3] = "flag"
        r = run(write_result(valid_security(verdict="flag", verdicts=v)))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("security: flag", r.stdout)

    def test_flag_point_but_top_pass_blocks(self):
        v = ["pass"] * 8; v[3] = "flag"
        r = run(write_result(valid_security(verdict="pass", verdicts=v)))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("flag", r.stderr)

    def test_no_flag_but_top_flag_blocks(self):
        r = run(write_result(valid_security(verdict="flag")))
        self.assertNotEqual(r.returncode, 0)

    def test_missing_security_key_blocks(self):
        f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
        json.dump({"trigger": {}, "acceptance": None}, f); f.close()
        r = run(Path(f.name))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("security", r.stderr)

    def test_wrong_point_count_blocks(self):
        sec = valid_security(); sec["checklist"] = checklist()[:7]
        r = run(write_result(sec))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("8 points", r.stderr)

    def test_point_out_of_order_blocks(self):
        sec = valid_security()
        sec["checklist"][0], sec["checklist"][1] = sec["checklist"][1], sec["checklist"][0]
        r = run(write_result(sec))
        self.assertNotEqual(r.returncode, 0)

    def test_bad_verdict_blocks(self):
        sec = valid_security(); sec["checklist"][0]["verdict"] = "yes"
        r = run(write_result(sec))
        self.assertNotEqual(r.returncode, 0)

    def test_short_hash_blocks(self):
        sec = valid_security(); sec["scanned_hash"] = "abc"
        r = run(write_result(sec))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("scanned_hash", r.stderr)


class MaterialHash(unittest.TestCase):
    def _skill(self, body="# skill\nbody\n", ref=None, script=None):
        d = Path(tempfile.mkdtemp())
        (d / "SKILL.md").write_text(body)
        if ref is not None:
            (d / "references").mkdir()
            (d / "references" / "r.md").write_text(ref)
        if script is not None:
            (d / "scripts").mkdir()
            (d / "scripts" / "s.sh").write_text(script)
        return d

    def test_deterministic_64hex(self):
        d = self._skill(ref="doc", script="echo hi")
        a = run("--print-material-hash", d)
        b = run("--print-material-hash", d)
        self.assertEqual(a.returncode, 0, a.stderr)
        self.assertRegex(a.stdout.strip(), r"^[0-9a-f]{64}$")
        self.assertEqual(a.stdout, b.stdout)

    def test_body_change_changes_hash(self):
        d1 = self._skill(body="# one\n")
        d2 = self._skill(body="# two\n")
        self.assertNotEqual(run("--print-material-hash", d1).stdout,
                            run("--print-material-hash", d2).stdout)

    def test_script_change_changes_hash(self):
        d1 = self._skill(script="echo a")
        d2 = self._skill(script="echo b")
        self.assertNotEqual(run("--print-material-hash", d1).stdout,
                            run("--print-material-hash", d2).stdout)

    def test_metadata_does_not_affect_hash(self):
        d = self._skill()
        before = run("--print-material-hash", d).stdout
        (d / "metadata.yaml").write_text("purpose: x\n")
        (d / "evals").mkdir()
        (d / "evals" / "result.json").write_text("{}")
        after = run("--print-material-hash", d).stdout
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
