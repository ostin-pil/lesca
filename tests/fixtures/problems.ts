import type { Problem } from '@lesca/shared/types'

/**
 * Sample problem fixtures for testing
 * Based on real LeetCode problems (simplified for testing)
 */

export const twoSumProblem: Problem = {
  questionId: '1',
  questionFrontendId: '1',
  title: 'Two Sum',
  titleSlug: 'two-sum',
  likes: 15234,
  dislikes: 532,
  quality: 87.3,
  content: `<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>

<p>You may assume that each input would have <strong><em>exactly</em> one solution</strong>, and you may not use the <em>same</em> element twice.</p>

<p>You can return the answer in any order.</p>

<p>&nbsp;</p>
<p><strong class="example">Example 1:</strong></p>

<pre>
<strong>Input:</strong> nums = [2,7,11,15], target = 9
<strong>Output:</strong> [0,1]
<strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].
</pre>

<p><strong class="example">Example 2:</strong></p>

<pre>
<strong>Input:</strong> nums = [3,2,4], target = 6
<strong>Output:</strong> [1,2]
</pre>`,
  difficulty: 'Easy',
  exampleTestcases: '[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6',
  hints: [
    'A really brute force way would be to search for all possible pairs of numbers but that would be too slow.',
    'So we need a way to optimize. We can use a hash table to store the numbers we have seen so far.',
  ],
  topicTags: [
    { name: 'Array', slug: 'array' },
    { name: 'Hash Table', slug: 'hash-table' },
  ],
  companyTagStats: null,
  stats: JSON.stringify({
    totalAccepted: '10.5M',
    totalSubmission: '21.2M',
    totalAcceptedRaw: 10500000,
    totalSubmissionRaw: 21200000,
    acRate: '49.5%',
  }),
  codeSnippets: [
    {
      lang: 'C++',
      langSlug: 'cpp',
      code: 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};',
    },
    {
      lang: 'Java',
      langSlug: 'java',
      code: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}',
    },
    {
      lang: 'Python',
      langSlug: 'python',
      code: 'class Solution(object):\n    def twoSum(self, nums, target):\n        """\n        :type nums: List[int]\n        :type target: int\n        :rtype: List[int]\n        """\n        ',
    },
    {
      lang: 'Python3',
      langSlug: 'python3',
      code: 'class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        ',
    },
    {
      lang: 'JavaScript',
      langSlug: 'javascript',
      code: '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};',
    },
    {
      lang: 'TypeScript',
      langSlug: 'typescript',
      code: 'function twoSum(nums: number[], target: number): number[] {\n    \n};',
    },
  ],
  similarQuestions: JSON.stringify([
    {
      title: '3Sum',
      titleSlug: '3sum',
      difficulty: 'Medium',
      translatedTitle: null,
    },
    {
      title: '4Sum',
      titleSlug: '4sum',
      difficulty: 'Medium',
      translatedTitle: null,
    },
  ]),
  solution: null,
  mysqlSchemas: [],
  dataSchemas: [],
  isPaidOnly: false,
}

export const addTwoNumbersProblem: Problem = {
  questionId: '2',
  questionFrontendId: '2',
  title: 'Add Two Numbers',
  titleSlug: 'add-two-numbers',
  likes: 9876,
  dislikes: 321,
  quality: 82.1,
  content: `<p>You are given two <strong>non-empty</strong> linked lists representing two non-negative integers. The digits are stored in <strong>reverse order</strong>, and each of their nodes contains a single digit. Add the two numbers and return the sum&nbsp;as a linked list.</p>

<p>You may assume the two numbers do not contain any leading zero, except the number 0 itself.</p>

<p>&nbsp;</p>
<p><strong class="example">Example 1:</strong></p>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/02/addtwonumber1.jpg" style="width: 483px; height: 342px;" />
<pre>
<strong>Input:</strong> l1 = [2,4,3], l2 = [5,6,4]
<strong>Output:</strong> [7,0,8]
<strong>Explanation:</strong> 342 + 465 = 807.
</pre>`,
  difficulty: 'Medium',
  exampleTestcases: '[2,4,3]\n[5,6,4]\n[0]\n[0]\n[9,9,9,9,9,9,9]\n[9,9,9,9]',
  hints: [],
  topicTags: [
    { name: 'Linked List', slug: 'linked-list' },
    { name: 'Math', slug: 'math' },
    { name: 'Recursion', slug: 'recursion' },
  ],
  companyTagStats: null,
  stats: JSON.stringify({
    totalAccepted: '6.2M',
    totalSubmission: '15.8M',
    totalAcceptedRaw: 6200000,
    totalSubmissionRaw: 15800000,
    acRate: '39.2%',
  }),
  codeSnippets: [
    {
      lang: 'C++',
      langSlug: 'cpp',
      code: '/**\n * Definition for singly-linked list.\n * struct ListNode {\n *     int val;\n *     ListNode *next;\n *     ListNode() : val(0), next(nullptr) {}\n *     ListNode(int x) : val(x), next(nullptr) {}\n *     ListNode(int x, ListNode *next) : val(x), next(next) {}\n * };\n */\nclass Solution {\npublic:\n    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {\n        \n    }\n};',
    },
  ],
  similarQuestions: JSON.stringify([
    {
      title: 'Multiply Strings',
      titleSlug: 'multiply-strings',
      difficulty: 'Medium',
      translatedTitle: null,
    },
  ]),
  solution: null,
  mysqlSchemas: [],
  dataSchemas: [],
  isPaidOnly: false,
}

export const problemFixtures = {
  twoSum: twoSumProblem,
  addTwoNumbers: addTwoNumbersProblem,
}
