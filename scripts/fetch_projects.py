#!/usr/bin/env python3
"""Reads the public repositories of a GitHub profile and writes data/projects.json.

The website lists whatever is in that file, so a new repository shows up on the site by itself the next
time this script runs (the "Build and deploy site" workflow runs it every few hours).

Usage:
    OWNER=<github user or org> python scripts/fetch_projects.py [--out path]

Environment:
    OWNER      the profile to read (the workflow sets it to the repository owner)
    SITE_REPO  name of the website repository itself, so it is not listed (default: <OWNER>.github.io)
    GH_TOKEN   optional token; raises the API rate limit (the workflow passes GITHUB_TOKEN)

Rules (all configurable in site.config.json):
    - only public, non-fork, non-archived repositories
    - the website repo and the profile README repo (<OWNER>/<OWNER>) are skipped
    - a repository with the topic "nosite" is hidden; one with the topic "featured" is listed first
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.github.com"


def load_config():
    path = os.path.join(ROOT, "site.config.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return {}


def api(path):
    """GET a GitHub API path. Returns parsed JSON, or None on 404."""
    req = urllib.request.Request(API + path, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "profile-site-sync",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def list_repos(owner):
    repos, page = [], 1
    while True:
        chunk = api("/users/%s/repos?per_page=100&sort=pushed&page=%d" % (owner, page))
        if not chunk:
            break
        repos.extend(chunk)
        if len(chunk) < 100:
            break
        page += 1
    return repos


_rate_limited = False


def release_info(owner, repo):
    """Latest release of a repo, or None. If GitHub rate-limits us, stop asking and keep going,
    so a limit never costs us the whole project list."""
    global _rate_limited
    if _rate_limited:
        return None
    try:
        rel = api("/repos/%s/%s/releases/latest" % (owner, repo))
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            _rate_limited = True
            print("warning: GitHub rate limit reached; release info skipped from %s on" % repo, file=sys.stderr)
            return None
        raise
    if not rel:
        return None
    return {
        "tag": rel.get("tag_name"),
        "name": rel.get("name") or rel.get("tag_name"),
        "published": rel.get("published_at"),
        "url": rel.get("html_url"),
        "assets": [
            {
                "name": a.get("name"),
                "size": a.get("size"),
                "downloads": a.get("download_count"),
                "url": a.get("browser_download_url"),
            }
            for a in rel.get("assets", [])
        ],
    }


def build(owner, cfg):
    site_repo = os.environ.get("SITE_REPO") or "%s.github.io" % owner
    hide = cfg.get("hideTopic", "nosite")
    featured = cfg.get("featuredTopic", "featured")
    skip = {site_repo.lower(), owner.lower()} | {n.lower() for n in cfg.get("excludeRepos", [])}

    prof = api("/users/%s" % owner) or {}
    projects = []
    for r in list_repos(owner):
        topics = r.get("topics") or []
        if r.get("fork") or r.get("archived") or r.get("private") or r.get("disabled"):
            continue
        if r["name"].lower() in skip or hide in topics:
            continue
        projects.append({
            "name": r["name"],
            "description": r.get("description"),
            "url": r.get("html_url"),
            "homepage": (r.get("homepage") or None),
            "language": r.get("language"),
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "topics": topics,
            "featured": featured in topics,
            "pushed": r.get("pushed_at"),
            "created": r.get("created_at"),
            "license": (r.get("license") or {}).get("spdx_id"),
            "release": release_info(owner, r["name"]),
        })
    # featured first, then most recently pushed
    projects.sort(key=lambda p: p["pushed"] or "", reverse=True)
    projects.sort(key=lambda p: not p["featured"])
    return {
        "owner": owner,
        "profile": {
            "name": prof.get("name") or owner,
            "avatar": prof.get("avatar_url"),
            "bio": prof.get("bio"),
            "url": prof.get("html_url") or "https://github.com/" + owner,
        },
        "projects": projects,
    }


def main():
    args = sys.argv[1:]
    out = os.path.join(ROOT, "data", "projects.json")
    if "--out" in args:
        i = args.index("--out")
        out = args[i + 1]
        args = args[:i] + args[i + 2:]
    owner = os.environ.get("OWNER") or (args[0] if args else "")
    if not owner:
        sys.exit("OWNER is not set (set the OWNER environment variable or pass the user name)")

    data = build(owner, load_config())

    # Only rewrite the file when something besides the timestamp changed.
    try:
        with open(out, encoding="utf-8") as f:
            old = json.load(f)
        old.pop("generated", None)
        if old == data:
            print("no changes: %d projects" % len(data["projects"]))
            return
    except (OSError, ValueError):
        pass
    data["generated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote %d projects for %s -> %s" % (len(data["projects"]), owner, out))


if __name__ == "__main__":
    main()
