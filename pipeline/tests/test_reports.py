from gfso import reports

FEED = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
  <title>ReliefWeb - Updates</title>
  <item>
    <title>Somalia: Food Security Outlook, October 2026 - May 2027</title>
    <link>https://reliefweb.int/report/somalia/example-one</link>
    <pubDate>Wed, 25 Nov 2026 09:10:00 +0000</pubDate>
    <author>Famine Early Warning System Network</author>
    <description>
      &lt;div class="tag country"&gt;Country: Somalia&lt;/div&gt;
      &lt;div class="tag source"&gt;Source: Famine Early Warning System Network&lt;/div&gt;
      &lt;p&gt;Body text that must never be stored.&lt;/p&gt;
    </description>
    <category>Somalia</category>
    <category>Agriculture</category>
    <category>Food and Nutrition</category>
    <category>Analysis</category>
  </item>
  <item>
    <title>Bolivia country brief</title>
    <link>https://reliefweb.int/report/bolivia/example-two</link>
    <pubDate>Tue, 24 Nov 2026 09:10:00 +0000</pubDate>
    <description>
      &lt;div class="tag country"&gt;Country: Bolivia (Plurinational State of)&lt;/div&gt;
      &lt;div class="tag source"&gt;Source: World Food Programme&lt;/div&gt;
    </description>
  </item>
  <item>
    <title>Missing a link, so it cannot be a pointer</title>
    <pubDate>Mon, 23 Nov 2026 09:10:00 +0000</pubDate>
  </item>
</channel></rss>
"""


def test_parse_extracts_pointer_fields_only():
    index = reports._iso_index()
    out = reports._parse(FEED.encode(), "early_warning", index)
    # The item without a link is dropped: there is nothing to point at.
    assert len(out) == 2

    first = out[0]
    assert first["title"].startswith("Somalia: Food Security Outlook")
    assert first["url"] == "https://reliefweb.int/report/somalia/example-one"
    assert first["published"] == "2026-11-25"
    assert first["publisher"] == "Famine Early Warning System Network"
    assert first["countries"] == ["Somalia"]
    assert first["iso3"] == ["SOM"]
    assert first["forward_looking"] is True
    # Themes come from the controlled vocabulary, not every category.
    assert set(first["themes"]) <= {"Agriculture", "Food and Nutrition"}


def test_report_text_is_never_carried_through():
    """The registry classes this source link_only, so a regression that starts
    storing report bodies has to fail here rather than at review time."""
    index = reports._iso_index()
    out = reports._parse(FEED.encode(), "general", index)
    blob = repr(out)
    assert "Body text" not in blob
    assert "<div" not in blob and "<p>" not in blob
    for report in out:
        assert set(report) == {
            "title", "url", "published", "publisher", "countries",
            "iso3", "themes", "kind", "forward_looking",
        }


def test_un_long_form_country_names_resolve():
    index = reports._iso_index()
    assert reports._resolve("Bolivia (Plurinational State of)", index) == "BOL"
    assert reports._resolve("Syrian Arab Republic", index) == "SYR"
    assert reports._resolve("occupied Palestinian territory", index) == "PSE"
    assert reports._resolve("Ethiopia", index) == "ETH"
    # "World" is a ReliefWeb grouping, not a country, and must not be filed
    # against one.
    assert reports._resolve("World", index) is None
    assert reports._resolve("Not A Real Place", index) is None


def test_malformed_feed_yields_nothing_rather_than_raising():
    index = reports._iso_index()
    assert reports._parse(b"not xml at all", "general", index) == []
    assert reports._parse(b"<rss><no-channel/></rss>", "general", index) == []
