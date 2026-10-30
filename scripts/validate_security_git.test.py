# scripts/validate_security_git.test.py — the material hash covers what git tracks or would track, never what it ignores
import hashlib, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = str(Path(__file__).with_name("validate_security.py"))
DOC = Path(__file__).resolve().parent.parent / "docs" / "mechanisms" / "skill-eval.md"
SKILL = "plugins/p/skills/s"


def run(*args, cwd=None):
    return subprocess.run([sys.executable, SCRIPT, *map(str, args)],
                          capture_output=True, text=True, cwd=cwd)


def hash_of(skill, cwd=None):
    r = run("--print-material-hash", skill, cwd=cwd)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def git(repo, *args):
    subprocess.run(["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@t",
                    "-c", "commit.gpgsign=false", *args],
                   check=True, capture_output=True, text=True)


def walk_hash(skill_dir):
    # The pre-git hash, kept as the reference a clean skill must still match: SKILL.md plus every
    # file under references/ and scripts/, sorted by skill-relative path, fed as path NUL bytes NUL.
    entries = []
    if (skill_dir / "SKILL.md").is_file():
        entries.append((Path("SKILL.md"), skill_dir / "SKILL.md"))
    for d in ("references", "scripts"):
        base = skill_dir / d
        if base.is_dir():
            entries += [(f.relative_to(skill_dir), f) for f in base.rglob("*") if f.is_file()]
    entries.sort(key=lambda e: str(e[0]))
    h = hashlib.sha256()
    for rel, f in entries:
        h.update(str(rel).encode()); h.update(b"\0")
        h.update(f.read_bytes()); h.update(b"\0")
    return h.hexdigest()


class GitSkill(unittest.TestCase):
    def setUp(self):
        # Setup — a committed skill shaped like plugins/film/skills/feature: a bundled example whose
        # own .gitignore hides its local build in out/, plus a root .gitignore.
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        git(self.root, "init", "-q")
        (self.root / ".gitignore").write_text("*.log\n")
        self.skill = self.root / SKILL
        (self.skill / "references").mkdir(parents=True)
        (self.skill / "scripts" / "example").mkdir(parents=True)
        (self.skill / "SKILL.md").write_text("# skill\nbody\n")
        (self.skill / "references" / "r.md").write_text("doc\n")
        (self.skill / "scripts" / "s.sh").write_text("echo hi\n")
        (self.skill / "scripts" / "example" / ".gitignore").write_text("out/\n")
        (self.skill / "scripts" / "example" / "lib.js").write_text("export const x = 1;\n")
        git(self.root, "add", "-A")
        git(self.root, "commit", "-q", "-m", "fixture")


class IgnoredFiles(GitSkill):
    def test_nested_gitignore_build_does_not_affect_hash(self):
        # Setup — the local build the example's .gitignore hides; a clean CI checkout never has it.
        before = hash_of(SKILL, cwd=self.root)
        out = self.skill / "scripts" / "example" / "out"
        out.mkdir()
        (out / "bundle.js").write_text("built\n")

        # Exercise + Verify
        self.assertEqual(before, hash_of(SKILL, cwd=self.root))

    def test_root_gitignore_does_not_affect_hash(self):
        before = hash_of(SKILL, cwd=self.root)
        (self.skill / "scripts" / "debug.log").write_text("noise\n")
        (self.skill / "references" / "trace.log").write_text("noise\n")
        self.assertEqual(before, hash_of(SKILL, cwd=self.root))

    def test_unignored_artefacts_stay_excluded(self):
        before = hash_of(SKILL, cwd=self.root)
        cache = self.skill / "scripts" / "__pycache__"
        cache.mkdir()
        (cache / "x.cpython-314.pyc").write_bytes(b"\x00compiled\x00")
        (self.skill / "scripts" / "stray.pyc").write_bytes(b"\x00compiled\x00")
        self.assertEqual(before, hash_of(SKILL, cwd=self.root))


class CleanSkillUnchanged(GitSkill):
    def test_clean_git_skill_hashes_as_the_filesystem_walk(self):
        # A recorded scanned_hash of an untouched skill must not go stale with the switch to git.
        self.assertEqual(walk_hash(self.skill), hash_of(SKILL, cwd=self.root))

    def test_non_git_dir_hashes_as_the_filesystem_walk(self):
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, True)
        (d / "scripts").mkdir()
        (d / "SKILL.md").write_text("# skill\n")
        (d / "scripts" / "s.sh").write_text("echo hi\n")
        self.assertEqual(walk_hash(d), hash_of(d))


class WouldTrack(GitSkill):
    def test_untracked_unignored_file_counts(self):
        before = hash_of(SKILL, cwd=self.root)
        (self.skill / "scripts" / "new.sh").write_text("echo new\n")
        after = hash_of(SKILL, cwd=self.root)
        self.assertNotEqual(before, after)
        self.assertEqual(walk_hash(self.skill), after)

    def test_tracked_file_deleted_from_disk_is_skipped(self):
        (self.skill / "scripts" / "example" / "lib.js").unlink()
        self.assertEqual(walk_hash(self.skill), hash_of(SKILL, cwd=self.root))


class Cli(GitSkill):
    def test_relative_from_root_matches_absolute_from_elsewhere(self):
        rel = hash_of(SKILL, cwd=self.root)
        elsewhere = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, elsewhere, True)
        self.assertRegex(rel, r"^[0-9a-f]{64}$")
        self.assertEqual(rel, hash_of(self.skill.resolve(), cwd=elsewhere))
        self.assertEqual(rel, hash_of(self.skill, cwd=elsewhere))

    def test_not_a_directory_exits_nonzero(self):
        r = run("--print-material-hash", self.skill / "SKILL.md")
        self.assertNotEqual(r.returncode, 0)


class Doc(unittest.TestCase):
    def test_doc_describes_the_git_listing(self):
        text = DOC.read_text()
        self.assertNotIn("The walk is over the FILESYSTEM, not over git", text)
        self.assertRegex(text, r"(?i)ignored by git|git[- ]ignored|gitignore")


if __name__ == "__main__":
    unittest.main()
