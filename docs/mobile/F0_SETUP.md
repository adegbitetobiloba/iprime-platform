# F0 setup (Codespaces, phone browser)

1. github.com, your repo, Code, Codespaces, Create. Use "Desktop site" mode.
2. In Codespaces Explorer, Upload `iprime-mobile-F0.zip` to the repo root, then in the terminal:
   `unzip iprime-mobile-F0.zip`
3. `git checkout -b stream-1/f0-scaffold`
4. `bash iprime-mobile-F0/bootstrap.sh`  (takes several minutes)
5. Paste ALL the output (typecheck, lint, test) back to Account 1.
6. `rm -rf iprime-mobile-F0 iprime-mobile-F0.zip`, then `git add -A`, `git commit -m "F0 mobile scaffold"`, `git push -u origin stream-1/f0-scaffold`. Open a Pull Request; only you merge.

Before any build, edit `mobile/eas.json`: replace both REPLACE-WITH-... URLs (public values only, never secrets).
Do not run `eas build` yet. First confirm the package name `ng.iprime.app` in `mobile/app.config.ts`.
