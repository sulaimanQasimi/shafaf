# Wiki Source for شفاف (Shafaf)

This folder contains the **Markdown source** for the GitHub Wiki (or docs site) of the شفاف (Shafaf) project.

## Pages

| File | Wiki page name | Description |
|------|----------------|-------------|
| `Home.md` | Home | Overview, feature list, quick links |
| `Getting-Started.md` | Getting-Started | First run, license, login |
| `Installation.md` | Installation | Windows and Android install from Releases |
| `Features.md` | Features | Modules and main workflows |
| `Development.md` | Development | Prerequisites, setup, project layout |
| `Building-and-Release.md` | Building-and-Release | Local build and GitHub release workflow |
| `Configuration.md` | Configuration | Env vars and company settings |
| `Android-Setup.md` | Android-Setup | JDK, SDK, NDK, signing, CI keystore |
| `Troubleshooting.md` | Troubleshooting | Common build and runtime issues |
| `License.md` | License | License check and license-generator |

## Adding to GitHub Wiki

1. In the repo: **Settings → General → Features** → enable **Wikis**.
2. Open **Wiki** in the repo.
3. For each `.md` file:
   - Create a new page with the same name as the file (without `.md`), e.g. `Getting-Started`.
   - Paste the content from the `.md` file.
4. In the sidebar, set **Home** as the wiki home.
5. Optional: replace `YOUR_ORG/tauri-app` in `Home.md` and `Installation.md` with your `owner/repo` for correct Release links.

## Using as /docs or a docs site

You can also:

- Copy the `wiki/` folder to `docs/` and point GitHub Pages or another tool at it.
- Use the Markdown with MkDocs, Docusaurus, or similar; adjust internal links (e.g. `(Getting-Started)` → `(Getting-Started.md)` or your site’s URL scheme) as needed.
