package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestScanURL(t *testing.T) {
	testcases := []struct {
		TestName string
		URL      string
		Expected bool
	}{
		{
			TestName: "fraud",
			URL:      "http://www.marketingbyinternet.com/mo/e56508df639f6ce7d55c81ee3fcd5ba8/",
			// "don't click. I'm not responsible for any consequence if you click this link ..."
			Expected: true,
		},
		{
			TestName: "clean",
			URL:      "https://github.com/tidwall/gjson/blob/master/LICENSE",
			Expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.TestName, func(t *testing.T) {
			fraud, err := scanURL(tc.URL)
			if err != nil {
				t.Errorf("failed to perform scanning URL: %s", err)
				t.FailNow()
			}
			assert.Equal(t, tc.Expected, fraud)
		})
	}
}
