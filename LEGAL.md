# Legal Disclaimer and Usage Guidelines

**IMPORTANT: Please read this document carefully before using Lesca.**

## 1. Disclaimer

Lesca is an open-source tool developed for educational and personal archiving purposes. It is **not affiliated with, endorsed by, or connected to LeetCode** (leetcode.com).

**Use of this tool is entirely at your own risk.** The authors and contributors of Lesca accept no responsibility for any consequences arising from its use, including but not limited to:

- Account termination or suspension by LeetCode.
- IP bans.
- Legal action.

## 2. Terms of Service Violation

You should be aware that LeetCode's [Terms of Service](https://leetcode.com/terms/) explicitly prohibit:

- "Crawling," "scraping," or "spidering" any part of the Service.
- Using automated means to access the Service.

**Using Lesca technically violates these terms.** By using this tool, you acknowledge that you are acting against LeetCode's official rules and assume all associated risks.

## 3. Copyright and Personal Use

All content scraped from LeetCode (problems, descriptions, editorial solutions, code snippets) is the **exclusive property of LeetCode** and its licensors, protected by copyright laws.

- **Personal Use Only**: You may use the data downloaded by Lesca strictly for your own personal study, offline access, and educational purposes.
- **No Distribution**: You **MUST NOT** redistribute, republish, or share the scraped content publicly (e.g., in a public GitHub repository, blog, or website). Doing so is a direct violation of copyright law.
- **Private Repositories**: If you store scraped data in a version control system, ensure the repository is **private**.

## 4. Robots.txt and Technical Compliance

LeetCode's `robots.txt` file disallows automated access to specific paths, including `/graphql`, which Lesca uses to retrieve data.

While Lesca implements features to be "polite" (see below), it does not strictly adhere to the `Disallow` directives in `robots.txt` because it acts as a user agent on your behalf to access data you are authorized to view.

## 5. Ethical Scraping and Risk Mitigation

To minimize the impact on LeetCode's servers and reduce the risk of detection, Lesca includes the following features:

- **Rate Limiting**: Requests are delayed and jittered to mimic human behavior. **Do not disable or aggressively lower these limits.**
- **Caching**: Scraped data is cached locally to prevent redundant network requests.
- **Browser Automation**: Uses a real browser instance for certain tasks to behave more like a standard user.

## 6. Recommendations for Users

1.  **Do not use your main LeetCode account** if you are concerned about potential bans. Consider using a secondary account for scraping.
2.  **Limit your scraping volume.** Do not scrape thousands of problems in a single burst.
3.  **Respect the platform.** LeetCode provides a valuable service. Do not abuse their resources.
4.  **Keep it local.** Treat the downloaded data as your personal offline notebook.

By continuing to use Lesca, you agree to abide by these guidelines and take full responsibility for your actions.
