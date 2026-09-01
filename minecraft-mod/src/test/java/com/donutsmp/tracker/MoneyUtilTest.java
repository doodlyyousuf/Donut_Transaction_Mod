package com.donutsmp.tracker;

import com.donutsmp.tracker.parser.MoneyUtil;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MoneyUtilTest {
    @Test void suffixes() {
        assertEquals("500", MoneyUtil.parse("$ 500"));
        assertEquals("10000", MoneyUtil.parse("$ 10,000"));
        assertEquals("63700", MoneyUtil.parse("$ 63.7K"));
        assertEquals("39000", MoneyUtil.parse("$ 39K"));
        assertEquals("440000", MoneyUtil.parse("$ 440K"));
        assertEquals("1200000", MoneyUtil.parse("$ 1.2M"));
        assertEquals("5000000000", MoneyUtil.parse("$ 5B"));
        assertEquals("1500000000000", MoneyUtil.parse("$ 1.5T"));
    }

    @Test void malformed() {
        assertNull(MoneyUtil.parse(null));
        assertNull(MoneyUtil.parse("$"));
        assertNull(MoneyUtil.parse("abc"));
    }
}
