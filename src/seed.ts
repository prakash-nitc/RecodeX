// Initial import extracted from "DSA patterns Cheat Sheet – Revision Master" (PDF) and the
// Google Sheets "Today's Focus" tracker. Ratings and dates exist only where the PDF had them.
// Link codes: lc:<slug> = LeetCode problem, g:<query> = GeeksforGeeks search, '' = no link.
import type { Difficulty, Phase, Rating, LearningState } from './types';

export interface SeedRow {
  name: string;
  difficulty: Difficulty;
  link: string;
  sub: string;
  original: string;
  rating?: Rating;
  lastRevised?: string;
  nextReview?: string;
  phase?: Phase;
  weakness?: string;
}

export interface SeedPattern {
  name: string;
  learning: LearningState;
  description: string;
  rows: SeedRow[];
}

type R = [string, Difficulty, string, string, string?, Partial<SeedRow>?];

const E: Difficulty = 'Easy', M: Difficulty = 'Medium', H: Difficulty = 'Hard';
const G = (d: string, n: string): Partial<SeedRow> => ({ rating: 'green', lastRevised: d, nextReview: n });
const Y = (d: string, n: string): Partial<SeedRow> => ({ rating: 'yellow', lastRevised: d, nextReview: n });
const Rd = (d: string, n: string): Partial<SeedRow> => ({ rating: 'red', lastRevised: d, nextReview: n });
const REC: Partial<SeedRow> = { phase: 'Reconstruction' };
const w = (a: Partial<SeedRow>, b: Partial<SeedRow>) => ({ ...a, ...b });

const SW_WEAKNESS =
  "Forgot to increment the left pointer while shrinking the window. Why: focused on updating character frequencies but forgot to maintain both window boundaries. Prevention cue: every shrink iteration must update the outgoing character's frequency, remove its key if the count reaches zero, and advance the left pointer.";

function rows(list: R[]): SeedRow[] {
  return list.map(([name, difficulty, link, sub, original, extra]) => ({
    name, difficulty, link, sub, original: original ?? name, ...(extra ?? {}),
  }));
}

export const SEED: SeedPattern[] = [
  {
    name: 'Two Pointers', learning: 'active',
    description: 'Two indices moving through a sorted array, string or list to find pairs, triplets or partitions in linear time.',
    rows: rows([
      ['Two Sum II', M, 'lc:two-sum-ii-input-array-is-sorted', 'Pair Sum', 'Two Sum II', w(G('2026-10-03', '2026-10-15'), REC)],
      ['Two Sum — Unique Pairs', M, 'g:count pairs with given sum unique pairs', 'Pair Sum', 'Two Sum — Unique Pairs', w(G('2026-10-03', '2026-10-15'), REC)],
      ['Rearrange 0 and 1', E, 'g:segregate 0s and 1s', 'Partitioning', 'Rearrange 0 and 1', Y('2026-10-03', '2026-10-09')],
      ['Remove Duplicates LL', E, 'lc:remove-duplicates-from-sorted-list', 'Remove Duplicates', 'Remove Duplicates LL', Y('2026-10-03', '2026-10-09')],
      ['Remove Duplicates Array (LC26)', E, 'lc:remove-duplicates-from-sorted-array', 'Remove Duplicates', 'Remove Duplicates Array (LC26)', Y('2026-10-03', '2026-10-09')],
      ['Squaring a Sorted Array', E, 'lc:squares-of-a-sorted-array', 'Pair Sum', 'Squaring a Sorted Array (easy)', Y('2026-10-03', '2026-10-09')],
      ['Triplet Sum to Zero', M, 'lc:3sum', 'Triplets', 'Triplet Sum to Zero (medium)', Rd('2026-10-03', '2026-10-06')],
      ['Triplet Sum Close to Target', M, 'lc:3sum-closest', 'Triplets', 'Triplet Sum Close to Target (medium)', Y('2026-10-03', '2026-10-09')],
      ['Triplets with Smaller Sum', M, 'lc:3sum-smaller', 'Triplets', 'Triplets with Smaller Sum (medium)'],
      ['Subarrays with Product Less than a Target', M, 'lc:subarray-product-less-than-k', 'Subarrays', 'Subarrays with Product Less than a Target (medium)'],
      ['Dutch National Flag Problem', M, 'lc:sort-colors', 'Partitioning', 'Dutch National Flag Problem (medium)', Y('2026-10-03', '2026-10-09')],
      ['Quadruple Sum to Target', M, 'lc:4sum', 'Problem Challenges', 'Problem Challenge 1: Quadruple Sum to Target (medium)'],
      ['Comparing Strings containing Backspaces', M, 'lc:backspace-string-compare', 'Problem Challenges', 'Problem Challenge 2: Comparing Strings containing Backspaces (medium)'],
      ['Minimum Window Sort', M, 'lc:shortest-unsorted-continuous-subarray', 'Problem Challenges', 'Problem Challenge 3: Minimum Window Sort (medium)'],
    ]),
  },
  {
    name: 'Fast & Slow Pointers', learning: 'active',
    description: 'Two pointers at different speeds to detect cycles and find middles in linked lists and sequences.',
    rows: rows([
      ['LinkedList Cycle', E, 'lc:linked-list-cycle', 'Cycles', 'LinkedList Cycle (easy)'],
      ['Start of LinkedList Cycle', M, 'lc:linked-list-cycle-ii', 'Cycles', 'Start of LinkedList Cycle (medium)'],
      ['Happy Number', M, 'lc:happy-number', 'Cycles', 'Happy Number (medium)'],
      ['Find Duplicate Number', M, 'lc:find-the-duplicate-number', 'Cycles', 'FIND DUPLICATE NUMBER'],
      ['Middle of the LinkedList', E, 'lc:middle-of-the-linked-list', 'Middle', 'Middle of the LinkedList (easy)'],
      ['Palindrome LinkedList', M, 'lc:palindrome-linked-list', 'Problem Challenges', 'Problem Challenge 1: Palindrome LinkedList (medium)'],
      ['Rearrange a LinkedList', M, 'lc:reorder-list', 'Problem Challenges', 'Problem Challenge 2: Rearrange a LinkedList (medium)'],
      ['Cycle in a Circular Array', H, 'lc:circular-array-loop', 'Problem Challenges', 'Problem Challenge 3: Cycle in a Circular Array (hard)'],
    ]),
  },
  {
    name: 'Sliding Window', learning: 'active',
    description: 'Grow and shrink a contiguous window while maintaining a running sum, count or frequency map.',
    rows: rows([
      ['Maximum Sum Subarray of Size K', E, 'g:max sum subarray of size k', 'Fixed Window', 'Maximum Sum Subarray of Size K (easy)', w(Y('2026-10-05', '2026-10-11'), REC)],
      ['Smallest Subarray with a Given Sum', E, 'g:smallest subarray with sum greater than x', 'Variable Window', 'Smallest Subarray with a given sum (easy)', REC],
      ['Longest Substring with K Distinct Characters', M, 'lc:longest-substring-with-at-most-k-distinct-characters', 'Variable Window', 'Longest Substring with K Distinct Characters (medium)', REC],
      ['Fruits into Baskets', M, 'lc:fruit-into-baskets', 'Variable Window', 'Fruits into Baskets (medium)', w(Rd('2026-10-06', '2026-10-09'), REC)],
      ['Longest Substring Without Repeating Characters', M, 'lc:longest-substring-without-repeating-characters', 'Variable Window', 'Longest Substring Without Repeating Characters', w(Y('2026-10-06', '2026-10-12'), { phase: 'Reconstruction', weakness: SW_WEAKNESS })],
      ['Longest Substring with Same Letters after Replacement', H, 'lc:longest-repeating-character-replacement', 'Replacement', 'Longest Substring with Same Letters after Replacement (hard)', REC],
      ['Longest Subarray with Ones after Replacement', H, 'lc:max-consecutive-ones-iii', 'Replacement', 'Longest Subarray with Ones after Replacement (hard)', REC],
      ['Minimum Size Subarray Sum', M, 'lc:minimum-size-subarray-sum', 'Variable Window', 'Minimum size subarray SUM', w(Y('2026-10-06', '2026-10-12'), REC)],
      ["Longest Subarray of 1's After Deleting One Element", M, 'lc:longest-subarray-of-1s-after-deleting-one-element', 'Replacement', "Longest Subarray of 1's After Deleting One Element", Y('2026-10-06', '2026-10-12')],
      ['Minimum Size Substring', H, 'lc:minimum-window-substring', 'Variable Window', 'MInimum Size Substring (HARD)', REC],
      ['Permutation in a String', H, 'lc:permutation-in-string', 'Problem Challenges', 'Problem Challenge 1: Permutation in a String (hard)', REC],
      ['String Anagrams', H, 'lc:find-all-anagrams-in-a-string', 'Problem Challenges', 'Problem Challenge 2: String Anagrams (hard)', REC],
      ['Words Concatenation', H, 'lc:substring-with-concatenation-of-all-words', 'Problem Challenges', 'Problem Challenge 4: Words Concatenation (hard)', REC],
    ]),
  },
  {
    name: "Kadane's Algorithm", learning: 'active',
    description: 'Extend or restart a running subarray at each index; the base for max/min/product/circular variants.',
    rows: rows([
      ['Maximum Subarray Sum', M, 'lc:maximum-subarray', 'Core', 'Maximum subarray sum', G('2026-10-13', '2026-10-25')],
      ['Minimum Subarray Sum', M, 'g:smallest sum contiguous subarray', 'Core', 'Minimum Subarray Sum', G('2026-10-13', '2026-10-25')],
      ['Maximum Product Subarray', M, 'lc:maximum-product-subarray', 'Variants', 'Maximum product subarray', G('2026-10-13', '2026-10-25')],
      ['Maximum Subarray Sum with One Deletion', M, 'lc:maximum-subarray-sum-with-one-deletion', 'Variants', 'Maximum subarray sum with one deletion', G('2026-10-13', '2026-10-25')],
      ['Maximum Absolute Sum of Any Subarray', M, 'lc:maximum-absolute-sum-of-any-subarray', 'Variants', 'Maximum absolute sum of any subarray', G('2026-10-13', '2026-10-25')],
      ['Maximum Sum Circular Subarray', M, 'lc:maximum-sum-circular-subarray', 'Variants', 'Maximum sum in circular array variant', G('2026-10-13', '2026-10-25')],
    ]),
  },
  {
    name: 'Prefix Sum', learning: 'active',
    description: 'Running totals plus a hash map of seen prefixes turn subarray-sum questions into lookups.',
    rows: rows([
      ['Subarray Sum Equals K', E, 'lc:subarray-sum-equals-k', 'Prefix + Hash Map', 'Subarray Sum Equals K (EASY)', Y('2026-10-17', '2026-10-23')],
      ['Find Pivot Index', E, 'lc:find-pivot-index', 'Basic Prefix', 'Find Pivot Index (EASY)', G('2026-10-16', '2026-10-28')],
      ['Subarray Sums Divisible by K', M, 'lc:subarray-sums-divisible-by-k', 'Prefix + Hash Map', 'Subarray Sums Divisible By K (Med)'],
      ['Contiguous Array', M, 'lc:contiguous-array', 'Prefix + Hash Map', 'Contiguous array (MED)'],
      ['Shortest Subarray with Sum at Least K', H, 'lc:shortest-subarray-with-sum-at-least-k', 'Problem Challenges', 'Problem challenge: Shortest Subarray With Sum at Least K (HARD)'],
      ['Count of Range Sum', H, 'lc:count-of-range-sum', 'Problem Challenges', 'Problem challenge: Count Range Sum (hard)'],
    ]),
  },
  {
    name: 'Merge Intervals', learning: 'active',
    description: 'Sort by start, then merge, insert or intersect overlapping ranges.',
    rows: rows([
      ['Merge Intervals', M, 'lc:merge-intervals', 'Core', 'Merge Intervals (medium)'],
      ['Insert Interval', M, 'lc:insert-interval', 'Core', 'Insert Interval (medium)'],
      ['Intervals Intersection', M, 'lc:interval-list-intersections', 'Core', 'Intervals Intersection (medium)'],
      ['Overlapping Intervals', M, 'g:overlapping intervals', 'Core', 'Overlapping Intervals'],
      ['Minimum Meeting Rooms', H, 'lc:meeting-rooms-ii', 'Problem Challenges', 'Problem Challenge 1: Minimum Meeting Rooms (hard)'],
      ['Maximum CPU Load', H, 'g:maximum cpu load intervals', 'Problem Challenges', 'Problem Challenge 2: Maximum CPU Load (hard)'],
      ['Employee Free Time', H, 'lc:employee-free-time', 'Problem Challenges', 'Problem Challenge 3: Employee Free Time (hard)'],
    ]),
  },
  {
    name: 'In-place Reversal of LinkedList', learning: 'active',
    description: 'Reverse links in place with prev/curr/next pointers, for whole lists, sub-lists and groups.',
    rows: rows([
      ['Reverse a LinkedList', E, 'lc:reverse-linked-list', 'Core', 'Reverse a LinkedList (easy)'],
      ['Reverse a Sub-list', M, 'lc:reverse-linked-list-ii', 'Core', 'Reverse a Sub-list (medium)'],
      ['Reverse List in Pairs', M, 'lc:swap-nodes-in-pairs', 'Groups', 'Reverse List in Pairs (Medium)'],
      ['Reverse every K-element Sub-list', H, 'lc:reverse-nodes-in-k-group', 'Groups', 'Reverse every K-element Sub-list (HARD)'],
      ['Reverse Nodes in Even Length Groups', H, 'lc:reverse-nodes-in-even-length-groups', 'Problem Challenges', 'Problem Challenge 1: Reverse nodes in EVEN Length Groups (HARD)'],
      ['Rotate a LinkedList', M, 'lc:rotate-list', 'Problem Challenges', 'Problem Challenge 2: Rotate a LinkedList (medium)'],
    ]),
  },
  {
    name: 'Stack', learning: 'active',
    description: 'LIFO processing for matching, adjacent removal and monotonic next-greater problems.',
    rows: rows([
      ['Remove Adjacent Duplicates', E, 'lc:remove-all-adjacent-duplicates-in-string', 'Basics', 'remove adjacent duplicates'],
      ['Balanced Parentheses', E, 'lc:valid-parentheses', 'Basics', 'Balanced Parentheses'],
      ['Reverse a String', E, 'lc:reverse-string', 'Basics', 'Reverse a String'],
      ['Next Greater Element', E, 'lc:next-greater-element-i', 'Monotonic Stack', 'Next Greater Element (easy)'],
      ['Daily Temperatures', E, 'lc:daily-temperatures', 'Monotonic Stack', 'Daily Temperatures (easy)'],
      ['Remove Nodes From Linked List', E, 'lc:remove-nodes-from-linked-list', 'Monotonic Stack', 'Remove Nodes From Linked List (easy)'],
      ['Remove All Adjacent Duplicates in String II', M, 'lc:remove-all-adjacent-duplicates-in-string-ii', 'Basics', 'Remove All Adjacent Duplicates in String II (medium)'],
      ['Simplify Path', M, 'lc:simplify-path', 'Problem Challenges', 'Simplify Path (Problem Challenge)'],
      ['Remove K Digits', H, 'lc:remove-k-digits', 'Problem Challenges', 'Remove K Digits (hard) Problem challenge'],
    ]),
  },
  {
    name: 'Hash Maps', learning: 'active',
    description: 'Frequency counts and complement lookups in O(1).',
    rows: rows([
      ['First Non-repeating Character', E, 'g:non repeating character', 'Frequency', 'First Non-repeating Character (easy)', G('2026-10-12', '2026-10-24')],
      ['Maximum Number of Balloons', E, 'lc:maximum-number-of-balloons', 'Frequency', 'Maximum Number of Balloons (easy)', G('2026-10-12', '2026-10-24')],
      ['Longest Palindrome', E, 'lc:longest-palindrome', 'Frequency', 'Longest Palindrome(easy)', G('2026-10-12', '2026-10-24')],
      ['2 Sum', E, 'lc:two-sum', 'Complement Lookup', '2 SUM', Y('2026-10-11', '2026-10-17')],
      ['Valid Anagram', E, 'lc:valid-anagram', 'Frequency', 'Valid Anagram', Y('2026-10-11', '2026-10-17')],
      ['First Unique Character in a String', E, 'lc:first-unique-character-in-a-string', 'Frequency', 'First Unique Character in a String', G('2026-10-11', '2026-10-23')],
      ['Ransom Note', E, 'lc:ransom-note', 'Frequency', 'Ransom Note (easy)', Y('2026-10-11', '2026-10-17')],
    ]),
  },
  {
    name: 'Binary Search', learning: 'active',
    description: 'Halve a monotonic search space: sorted arrays, rotated arrays, matrices, and binary search on the answer.',
    rows: rows([
      ['Binary Search Basic', E, 'lc:binary-search', 'Basics', 'Binary search basic'],
      ['Upper Bound / Ceiling', E, 'g:ceil in a sorted array', 'Basics', 'Upper Bound/ Ceiling'],
      ['First and Last Position', M, 'lc:find-first-and-last-position-of-element-in-sorted-array', 'Basics', 'First and Last position'],
      ['Count Number of Occurrences', E, 'g:number of occurrence sorted array', 'Basics', 'Count number of occurences'],
      ['Search in Infinite Sorted Array', M, 'lc:search-in-a-sorted-array-of-unknown-size', 'Basics', 'Search in infinite Sorted array'],
      ['Peak Index in Mountain Array', M, 'lc:peak-index-in-a-mountain-array', 'Peak & Mountain', 'Peak index in Mountain'],
      ['Find Peak in Mountain Range', M, 'lc:find-peak-element', 'Peak & Mountain', 'Find peak in mountain range'],
      ['Find Minimum in Rotated Sorted Array', M, 'lc:find-minimum-in-rotated-sorted-array', 'Rotated Arrays', 'Find minimum in rotated sorted array'],
      ['Find Number of Rotations in Sorted Array', E, 'g:find kth rotation sorted array', 'Rotated Arrays', 'Find number of rotations to sorted array'],
      ['Search in Rotated Sorted Array', M, 'lc:search-in-rotated-sorted-array', 'Rotated Arrays', 'Search in rotated sorted array'],
      ['Koko Eating Bananas', M, 'lc:koko-eating-bananas', 'Binary Search on Answer', 'KOKO eating BANANAS'],
      ['Min Number of Days to Make m Bouquets', M, 'lc:minimum-number-of-days-to-make-m-bouquets', 'Binary Search on Answer', 'Min num of days to make m bouquets'],
      ['Aggressive Cows', H, 'g:aggressive cows', 'Binary Search on Answer', 'Aggresive cows'],
      ['H-Index II', M, 'lc:h-index-ii', 'Binary Search on Answer', 'H index 2'],
      ['Max Candies to K Children', M, 'lc:maximum-candies-allocated-to-k-children', 'Binary Search on Answer', 'Max candies to k children'],
      ['Capacity to Ship Packages in D Days', M, 'lc:capacity-to-ship-packages-within-d-days', 'Binary Search on Answer', 'Capacity to ship packages in d days'],
      ['Book Allocation Problem', H, 'g:allocate minimum number of pages', 'Binary Search on Answer', 'Book Allocation Problem'],
      ['Split Array Largest Sum', H, 'lc:split-array-largest-sum', 'Binary Search on Answer', 'Split largest arrray'],
      ['Search a 2D Matrix', M, 'lc:search-a-2d-matrix', '2D Matrix', 'Search 2 D matrix'],
      ['Search a 2D Matrix II', H, 'lc:search-a-2d-matrix-ii', '2D Matrix', 'Search 2D matrix (Hard)'],
      ['Kth Smallest in Sorted Matrix', M, 'lc:kth-smallest-element-in-a-sorted-matrix', '2D Matrix', 'kth smallest in sorted matrix'],
      ['Kth Smallest in Multiplication Table', H, 'lc:kth-smallest-number-in-multiplication-table', '2D Matrix', 'kth smallest in multiplication matrix'],
      ['Median of Two Sorted Arrays', H, 'lc:median-of-two-sorted-arrays', 'Advanced', 'median of 2 sorted arrays'],
    ]),
  },
  {
    name: 'Heap', learning: 'active',
    description: 'Priority queues for top-K, k-way merging, greedy scheduling and running medians.',
    rows: rows([
      ['Kth Smallest Element', M, 'g:kth smallest element', 'Kth Element', 'Kth kth smallest'],
      ['Kth Largest Element', M, 'lc:kth-largest-element-in-an-array', 'Kth Element', 'kth largest'],
      ['Top K Frequent Elements', M, 'lc:top-k-frequent-elements', 'Top K', 'TOP K frequent Elements'],
      ['Top K Frequent Words', M, 'lc:top-k-frequent-words', 'Top K', 'Top K frequent Words'],
      ['K Closest Points to Origin', M, 'lc:k-closest-points-to-origin', 'K Closest', 'K closest K closest points to origin'],
      ['Find K Closest Elements', M, 'lc:find-k-closest-elements', 'K Closest', 'Find K closest elements'],
      ['Kth Weakest Row in Matrix', E, 'lc:the-k-weakest-rows-in-a-matrix', 'K Closest', 'Kth weakest row in Matrix'],
      ['Merge K Sorted Arrays', M, 'g:merge k sorted arrays', 'Heap as Pointer', 'heap as pointer Merge K Sorted Arrays'],
      ['Kth Smallest in Sorted Matrix', M, 'lc:kth-smallest-element-in-a-sorted-matrix', 'Heap as Pointer', 'Kth Smallest in Sorted Matrix'],
      ['Last Stone Weight', E, 'lc:last-stone-weight', 'Greedy + Heap', 'GREEDY+heap LAST STONE WEIGHT'],
      ['CPU Task Scheduler', M, 'lc:task-scheduler', 'Greedy + Heap', 'CPU Task Scheduler'],
      ['Reorganize String', M, 'lc:reorganize-string', 'Greedy + Heap', 'Reorganize String'],
      ['Min Number of Refueling Stops', H, 'lc:minimum-number-of-refueling-stops', 'Greedy + Heap', 'Min number of refueling stops'],
      ['IPO', H, 'lc:ipo', 'Greedy + Heap', 'IPO'],
      ['Course Schedule III', H, 'lc:course-schedule-iii', 'Greedy + Heap', 'Course Scheduler 3'],
      ['Find Median in Data Stream', H, 'lc:find-median-from-data-stream', 'Two Heaps', '2 heaps Find median in data stream'],
      ['Sliding Window Median', H, 'lc:sliding-window-median', 'Two Heaps', 'Sliding Window Median (hard)'],
    ]),
  },
  {
    name: 'Recursion and Backtracking', learning: 'active',
    description: 'Solve by smaller subproblems; explore choices and undo them to enumerate combinations.',
    rows: rows([
      ['Fibonacci', E, 'lc:fibonacci-number', 'Recursion Basics', 'Fibonnaci'],
      ['Check if String is Palindrome', E, 'g:recursive function to check if a string is palindrome', 'Recursion Basics', 'Check if string is Pallindrome'],
      ['Check if Array is Sorted', E, 'g:check if array is sorted using recursion', 'Recursion Basics', 'Check if Array is Sorted'],
      ['Sum of Digits of a Number', E, 'g:sum of digits of a number using recursion', 'Recursion Basics', 'Sum of digits of a number'],
      ['Remove Occurrences of a Character in String', E, 'g:remove all occurrences of a character in a string recursively', 'Recursion Basics', 'Remove occurences of a character in string'],
      ['Generate Parentheses', M, 'lc:generate-parentheses', 'Backtracking', 'Generate parenthesis'],
      ['Letter Combinations of Phone Number', M, 'lc:letter-combinations-of-a-phone-number', 'Backtracking', 'Letter Combinations of phone number'],
      ['Permutations', M, 'lc:permutations', 'Backtracking', 'Permutations'],
      ['Combination Sum', M, 'lc:combination-sum', 'Backtracking', 'Combination Sum'],
      ['Palindrome Partitioning', M, 'lc:palindrome-partitioning', 'Backtracking', 'Pallindrome partition'],
    ]),
  },
  {
    name: 'Trees', learning: 'active',
    description: 'DFS and BFS over binary trees and BSTs: traversals, symmetry, LCA, validation, path sums and construction.',
    rows: rows([
      ['Inorder Traversal', E, 'lc:binary-tree-inorder-traversal', 'Traversal', 'Traversal Inorder'],
      ['Preorder Traversal', E, 'lc:binary-tree-preorder-traversal', 'Traversal', 'Preorder'],
      ['Postorder Traversal', E, 'lc:binary-tree-postorder-traversal', 'Traversal', 'Postorder'],
      ['Level Order Traversal', M, 'lc:binary-tree-level-order-traversal', 'Traversal', 'Level Order'],
      ['Zigzag Level Order Traversal', M, 'lc:binary-tree-zigzag-level-order-traversal', 'Traversal', 'ZigZag Order'],
      ['Level Order Traversal II', M, 'lc:binary-tree-level-order-traversal-ii', 'Traversal', 'Level Order II'],
      ['Invert Binary Tree', E, 'lc:invert-binary-tree', 'Mirror and Symmetry', 'Mirror and Symmetry Invert Tree'],
      ['Symmetric Tree', E, 'lc:symmetric-tree', 'Mirror and Symmetry', 'Symmetric Tree'],
      ['Same Tree', E, 'lc:same-tree', 'Mirror and Symmetry', 'Same Tree'],
      ['Subtree of Another Tree', E, 'lc:subtree-of-another-tree', 'Mirror and Symmetry', 'Subtree of another TREE'],
      ['Flip Equivalent Binary Trees', M, 'lc:flip-equivalent-binary-trees', 'Mirror and Symmetry', 'Flip Equivalent Tree'],
      ['LCA of Binary Tree', M, 'lc:lowest-common-ancestor-of-a-binary-tree', 'Search and LCA', 'Search LCA of Binary TREE'],
      ['Search in a Binary Search Tree', E, 'lc:search-in-a-binary-search-tree', 'Search and LCA', 'Binary Search Tree'],
      ['LCA of BST', M, 'lc:lowest-common-ancestor-of-a-binary-search-tree', 'Search and LCA', 'LCA of BST'],
      ['LCA of Deepest Leaves', M, 'lc:lowest-common-ancestor-of-deepest-leaves', 'Search and LCA', 'LCA of Deepest Leaves'],
      ['Two Sum IV', E, 'lc:two-sum-iv-input-is-a-bst', 'Search and LCA', 'Two Sum IV'],
      ['Kth Smallest Element in BST', M, 'lc:kth-smallest-element-in-a-bst', 'Search and LCA', 'Kth smallest element in BST'],
      ['Minimum Depth of Binary Tree', E, 'lc:minimum-depth-of-binary-tree', 'Validation', 'Validation Minimum Depth of Binary Tree'],
      ['Maximum Depth of Binary Tree', E, 'lc:maximum-depth-of-binary-tree', 'Validation', 'Maximum Depth of Binary Tree'],
      ['Balanced Binary Tree', E, 'lc:balanced-binary-tree', 'Validation', 'Balanced Binary Tree'],
      ['Diameter of Binary Tree', E, 'lc:diameter-of-binary-tree', 'Validation', 'Diameter of Binary Tree'],
      ['Check Completeness of Binary Tree', M, 'lc:check-completeness-of-a-binary-tree', 'Validation', 'Check Completeness of Binary Tree'],
      ['Validate BST', M, 'lc:validate-binary-search-tree', 'Validation', 'Validate BST'],
      ['Recover BST', M, 'lc:recover-binary-search-tree', 'Validation', 'Recover BST'],
      ['Path Sum', E, 'lc:path-sum', 'Path Sum', 'Path SUM Path Sum'],
      ['Path Sum II', M, 'lc:path-sum-ii', 'Path Sum', 'Path Sum II'],
      ['Sum of Root to Leaf Numbers', M, 'lc:sum-root-to-leaf-numbers', 'Path Sum', 'Sum of Root to Leaf'],
      ['Binary Tree Maximum Path Sum', H, 'lc:binary-tree-maximum-path-sum', 'Path Sum', 'Maximum Path Sum'],
      ['Construct Tree from Preorder and Inorder', M, 'lc:construct-binary-tree-from-preorder-and-inorder-traversal', 'Construction', 'Construction Contruct tree from preorder and inorder'],
      ['Construct Tree from Postorder and Inorder', M, 'lc:construct-binary-tree-from-inorder-and-postorder-traversal', 'Construction', 'Contruct tree from postorder and inorder'],
      ['Sorted Array to BST', E, 'lc:convert-sorted-array-to-binary-search-tree', 'Construction', 'Sorted Array to BST'],
    ]),
  },
  {
    name: 'Graphs', learning: 'yet_to_learn',
    description: 'Adjacency lists, BFS/DFS, cycle detection, topological order, shortest paths and spanning trees.',
    rows: rows([
      ['Construct Adjacency List from Edges + Nodes', E, 'g:print adjacency list', 'Basics', 'Construct Adjancency List from EDGES+Nodes'],
      ['Graph DFS', E, 'g:dfs of graph', 'Basics', 'Graph DFS'],
      ['Graph BFS', E, 'g:bfs of graph', 'Basics', 'GRAPH BFS'],
      ['Number of Islands', M, 'lc:number-of-islands', 'Traversal and Flood Fill', 'Number of Islands'],
      ['Number of Provinces', M, 'lc:number-of-provinces', 'Traversal and Flood Fill', 'Number of Provinces'],
      ['Rotten Oranges', M, 'lc:rotting-oranges', 'Traversal and Flood Fill', 'Rotten Oranges'],
      ['Cycle Detection in Undirected Graph', M, 'g:detect cycle in an undirected graph', 'Cycles and Ordering', 'Cycle detection in undirected graph'],
      ['Cycle Detection in Directed Graph', M, 'g:detect cycle in a directed graph', 'Cycles and Ordering', 'Cycle detection in directed graph'],
      ['Topological Sort', M, 'g:topological sort', 'Cycles and Ordering', 'Topological sort'],
      ['Bipartite Graph / Graph Coloring', M, 'lc:is-graph-bipartite', 'Cycles and Ordering', 'Bipartite Graph/ Graph Coloring'],
      ['Surrounded Regions', M, 'lc:surrounded-regions', 'Traversal and Flood Fill', 'Surrounded Regoins'],
      ['Shortest Path in Non-Weighted Graph', M, 'g:shortest path in undirected graph having unit distance', 'Shortest Path', 'Shortest Path in Non-Weighted Graph'],
      ["Dijkstra's Algorithm", M, 'g:implementing dijkstra algorithm', 'Shortest Path', "Dijkstra's Algorithm"],
      ['Network Delay Time', M, 'lc:network-delay-time', 'Shortest Path', 'Network Delay'],
      ['Path With Minimum Effort', M, 'lc:path-with-minimum-effort', 'Shortest Path', 'Path With Minimum Effort'],
      ['Swim in Rising Water', H, 'lc:swim-in-rising-water', 'Shortest Path', 'Swim in Rising Water'],
      ['Bellman-Ford', M, 'g:distance from the source bellman ford algorithm', 'Shortest Path', 'Bellman ford'],
      ['Cheapest Flights Within K Stops', M, 'lc:cheapest-flights-within-k-stops', 'Shortest Path', 'Cheapest Path in K stops'],
      ["Prim's MST", M, 'g:minimum spanning tree prim', 'Minimum Spanning Tree', 'Prim MST'],
      ['Word Ladder', H, 'lc:word-ladder', 'Shortest Path', 'Word Ladder'],
    ]),
  },
  {
    name: 'Dynamic Programming', learning: 'yet_to_learn',
    description: 'Overlapping subproblems: memoization first, then tabulation, across 1D, knapsack, subsequence and grid families.',
    rows: rows([
      ['Ep 02 · Fibonacci', E, 'lc:fibonacci-number', '1D DP', 'Episode-02: Fibonacci'],
      ['Ep 03 · Climbing Stairs', E, 'lc:climbing-stairs', '1D DP', 'Episode 03: Climbing Stairs'],
      ['Ep 04 · House Robber', M, 'lc:house-robber', '1D DP', 'Episode 04: House Robber'],
      ['Ep 05 · 0/1 Knapsack', M, 'g:0 1 knapsack problem', 'Knapsack', 'Episode 05: 0/1 Knapsack'],
      ['Ep 06 · Tabulation Intro', E, '', 'Knapsack', 'Episode 06: tabulation Intro'],
      ['Ep 07 · 0/1 Knapsack Tabulation', M, 'g:0 1 knapsack problem', 'Knapsack', 'Episode 07: 0/1 Knapsack Tabulation'],
      ['Ep 08 · Subset Sum', M, 'g:subset sum problem', 'Knapsack', 'Episode 08: Subset sum'],
      ['Ep 09 · Target Sum', M, 'lc:target-sum', 'Knapsack', 'Episode 09 : Target Sum'],
      ['Ep 10 · LIS', M, 'lc:longest-increasing-subsequence', 'Subsequences', 'Episode 10 : LIS'],
      ['Ep 11 · LIS Tabulation', M, 'lc:longest-increasing-subsequence', 'Subsequences', 'Episode 11 : LIS Tabulation'],
      ['Ep 12 · LCS', M, 'lc:longest-common-subsequence', 'Subsequences', 'Episode 12 : LCS'],
      ['Ep 13 · Unique Paths', M, 'lc:unique-paths', 'Grid', 'Episode 13 : Unique Paths'],
      ['Ep 14 · Buy Sell Stocks', E, 'lc:best-time-to-buy-and-sell-stock', 'Stocks', 'Episode 14: Buy Sell Stocks'],
      ['Ep 15 · Min Cost to Cut Stick', H, 'lc:minimum-cost-to-cut-a-stick', 'Interval DP', 'Episode 15: MIn cost to cut stick'],
    ]),
  },
  {
    name: 'Greedy', learning: 'active',
    description: 'Make the locally best choice and prove it never hurts the final answer.',
    rows: rows([
      ['Lemonade Change', E, 'lc:lemonade-change', 'Core', 'Lemonade'],
      ['Jump Game', M, 'lc:jump-game', 'Core', 'Jump Game'],
      ['Assign Cookies', E, 'lc:assign-cookies', 'Core', 'Assign cookies'],
      ['Fractional Knapsack', M, 'g:fractional knapsack', 'Core', 'Fractional Knapsack'],
    ]),
  },
];

export function linkToUrl(link: string): string {
  if (!link) return '';
  if (link.startsWith('lc:')) return `https://leetcode.com/problems/${link.slice(3)}/`;
  if (link.startsWith('g:')) return `https://www.google.com/search?q=${encodeURIComponent('geeksforgeeks ' + link.slice(2))}`;
  return link;
}

export const SEED_NOTES = [
  'Blank rows in the DP section and "Episode 16: Revision" were skipped because they are not problems.',
  'Difficulty tags such as "(easy)" were moved from the name into the Difficulty field. Your original wording is kept on each problem as "Name in source".',
  'Problems with a GeeksforGeeks counterpart open a GFG search, because GFG problem URLs change often. LeetCode problems link directly.',
  'Kth Smallest in Sorted Matrix appears under both Binary Search and Heap, as in your sheet.',
];
